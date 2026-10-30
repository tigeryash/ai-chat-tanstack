// @vitest-environment jsdom
import { Chat } from "@ai-sdk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserChatTransport } from "@/lib/chat/browser-transport";
import { mockChatModel } from "@/lib/chat/mock-model";
import { ChatScreen } from "./chat-screen";

// Roadmap 3.1 puts several chats side by side, so a streaming reply must not re-render the rest of
// the screen (quality audit P4). Counts renders while the mock model streams a reply: only the
// streaming message and the composer may render per chunk; the header's picker stays put and, closed,
// does no catalog work.

const counts = vi.hoisted(() => ({
	messages: new Map<string, number>(),
	picker: 0,
	filterModels: 0,
}));

vi.mock("@/components/chat/chatstuff/message-ui", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/components/chat/chatstuff/message-ui")
		>();
	const MessageUI = actual.default;
	return {
		default: (props: Parameters<typeof MessageUI>[0]) => {
			const id = props.message.id;
			counts.messages.set(id, (counts.messages.get(id) ?? 0) + 1);
			return <MessageUI {...props} />;
		},
	};
});

vi.mock("@/components/models/model-picker", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/components/models/model-picker")>();
	const { ModelPicker } = actual;
	return {
		...actual,
		ModelPicker: (props: Parameters<typeof ModelPicker>[0]) => {
			counts.picker++;
			return <ModelPicker {...props} />;
		},
	};
});

vi.mock("@/lib/models/picker-filter", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/models/picker-filter")>();
	return {
		...actual,
		filterModels: (...args: Parameters<typeof actual.filterModels>) => {
			counts.filterModels++;
			return actual.filterModels(...args);
		},
	};
});

// The composer (Motion, dropzone) is out of scope here: a stub that sends.
vi.mock("@/components/chat/input", () => ({
	Input: ({ onSubmit }: { onSubmit: (text: string) => void }) => {
		return (
			<button type="button" onClick={() => onSubmit("hello")}>
				Send
			</button>
		);
	},
}));

vi.mock("@/lib/models/catalog", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/models/catalog")>();
	const { TEST_CATALOG } = await import("@/lib/models/test-catalog");
	const catalog = { data: TEST_CATALOG, isError: false, refetch: vi.fn() };
	const none = { data: undefined, isError: false };
	return {
		...actual,
		useModelCatalog: () => catalog,
		useCatalogModel: () => none,
	};
});

vi.mock("@/lib/keys/use-connected-providers", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/keys/use-connected-providers")>();
	const connected = new Set(["openrouter"]);
	return { ...actual, useConnectedProviders: () => connected };
});

const words = (count: number) =>
	Array.from({ length: count }, (_, index) => `word${index} `);

function renderChat(chat: Chat<UIMessage>) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, enabled: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<ChatScreen chat={chat} />
		</QueryClientProvider>,
	);
}

/** Sends one message, waits for the mock reply to finish, and returns each message's renders. */
async function streamReply(text: string[], chunkDelayInMs: number) {
	const chat = new Chat<UIMessage>({
		transport: new BrowserChatTransport(async () =>
			mockChatModel({ text, chunkDelayInMs }),
		),
	});
	renderChat(chat);
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "Send" }));
	});
	// One short act per tick, so React commits as chunks arrive (one long act would batch them).
	while (chat.status !== "ready") {
		await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
	}
	const [user, reply] = chat.messages;
	expect(user?.role).toBe("user");
	expect(reply?.role).toBe("assistant");
	return {
		user: counts.messages.get(user?.id ?? "") ?? 0,
		reply: counts.messages.get(reply?.id ?? "") ?? 0,
	};
}

describe("ChatScreen while a reply streams", () => {
	beforeEach(() => {
		localStorage.clear();
		counts.messages.clear();
		counts.picker = 0;
		counts.filterModels = 0;
	});
	afterEach(cleanup);

	it("re-renders only the streaming message, not finished ones or the picker", async () => {
		const renders = await streamReply(words(12), 70);

		// The reply rendered as it streamed (12 chunks, 70 ms apart)...
		expect(renders.reply).toBeGreaterThanOrEqual(12);
		// ...while the user's message rendered once: it was finished before the reply began.
		expect(renders.user).toBe(1);
		// The closed picker never filtered the catalog, and rendered only on load, when the person sent
		// and when the reply recorded its model (was once per chunk).
		expect(counts.filterModels).toBe(0);
		expect(counts.picker).toBeLessThanOrEqual(4);
	});

	it("throttles a fast stream to about one render per 50 ms", async () => {
		// 40 chunks 5 ms apart: ~200 ms of streaming, so about 4 throttled renders plus start and finish.
		const renders = await streamReply(words(40), 5);
		expect(renders.reply).toBeLessThan(15);
		expect(renders.user).toBe(1);
	});
});
