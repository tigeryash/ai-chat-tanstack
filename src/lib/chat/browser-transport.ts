import type {
	ChatTransport,
	LanguageModel,
	UIMessage,
	UIMessageChunk,
} from "ai";
import type { PromptSource } from "@/lib/prompts/provenance";
import type { ModelSelection } from "./model-selection";
import type { ReplyHost } from "./reply-host";
import type { ReplyStats } from "./reply-stats";

// The chat engine's transport (roadmap decision 7): `useChat` hands it the messages, and it runs
// `streamText` right here in the browser against the chosen provider. Nothing goes through our server.
// The provider and model come in each request's `body` (`sendMessage(…, { body: selection })`), so
// every pane can pick its own. The chat's settings ride along in `body.settings` (roadmap 2.4b): the
// transport sends only what the model and host support (src/lib/params/mapping.ts).
// The work happens in stream-reply.ts, which loads on the first send (perf/trim-new-route).

/**
 * Saved on each reply, so a chat shows which model wrote what, which host answered (roadmap 2.2b)
 * what it cost, and its tokens, TTFT and tokens/sec (roadmap 2.5). Every field after `gatewayId` is
 * optional, so older replies still read.
 */
export interface ReplyMetadata extends ReplyHost, ReplyStats {
	provider: ModelSelection["provider"];
	model: string;
	/** The catalog model, when it was picked from the catalog. */
	gatewayId?: string;
	/** The upstream the request pinned on a router. */
	upstream?: string;
	/** The saved prompt version sent as the system prompt (roadmap 3.6b); absent for none or hand-written. */
	prompt?: PromptSource;
}

export type ResolveModel = (
	selection: ModelSelection,
) => Promise<LanguageModel>;

const loadStreamReply = () => import("./stream-reply");

/**
 * Starts loading the send path as soon as the chat engine has loaded (chat-sessions.ts calls it), in a
 * task of its own, so the first send doesn't wait for it but the page doesn't preload it. A failed
 * download is retried by the send itself.
 */
export function prefetchStreamReply(): void {
	if (typeof window === "undefined") return;
	const load = () => {
		loadStreamReply().catch(() => undefined);
	};
	setTimeout(load, 0);
}

export class BrowserChatTransport implements ChatTransport<UIMessage> {
	readonly #resolveModel: ResolveModel | undefined;
	readonly #now: (() => number) | undefined;

	/**
	 * `resolveModel` swaps in a mock model for tests (default: the real provider, with the key from the
	 * vault, `provider-model.ts`), and `now` a clock for timing replies.
	 */
	constructor(resolveModel?: ResolveModel, now?: () => number) {
		this.#resolveModel = resolveModel;
		this.#now = now;
	}

	async sendMessages(
		options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
	): Promise<ReadableStream<UIMessageChunk>> {
		const { streamReply } = await loadStreamReply();
		return streamReply(options, this.#resolveModel, this.#now);
	}

	async reconnectToStream() {
		// Streams live in this tab; there's nothing on a server to resume.
		return null;
	}
}
