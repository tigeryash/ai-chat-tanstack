import { APICallError, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import {
	BrowserChatTransport,
	resolveProviderModel,
} from "./browser-transport";
import { ChatSetupError } from "./chat-errors";
import { mockChatModel } from "./mock-model";

vi.mock("@/lib/keys", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/keys")>()),
	getProviderKey: vi.fn(async () => null),
}));

const MESSAGES: UIMessage[] = [
	{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
];
const SELECTION = { provider: "openrouter", model: "some/model" } as const;

async function collect(stream: ReadableStream<UIMessageChunk>) {
	const chunks: UIMessageChunk[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	return chunks;
}

function send(transport: BrowserChatTransport, body: object | undefined) {
	return transport.sendMessages({
		trigger: "submit-message",
		chatId: "c1",
		messageId: undefined,
		messages: MESSAGES,
		abortSignal: undefined,
		body,
	});
}

describe("BrowserChatTransport", () => {
	it("streams reasoning and text from the chosen model, tagged with it", async () => {
		const resolveModel = vi.fn(async () =>
			mockChatModel({ reasoning: ["hmm"], text: ["Hel", "lo"] }),
		);
		const chunks = await collect(
			await send(new BrowserChatTransport(resolveModel), SELECTION),
		);

		expect(resolveModel).toHaveBeenCalledWith(SELECTION);
		expect(chunks[0]).toMatchObject({
			type: "start",
			messageMetadata: SELECTION,
		});
		const deltas = (type: string) =>
			chunks.flatMap((chunk) =>
				chunk.type === type && "delta" in chunk ? [chunk.delta] : [],
			);
		expect(deltas("reasoning-delta")).toEqual(["hmm"]);
		expect(deltas("text-delta")).toEqual(["Hel", "lo"]);
	});

	it("refuses a request without a provider and model", async () => {
		const transport = new BrowserChatTransport(async () =>
			mockChatModel({ text: ["x"] }),
		);
		await expect(send(transport, undefined)).rejects.toThrow(
			"Pick a provider and a model first.",
		);
		await expect(
			send(transport, { provider: "openrouter", model: " " }),
		).rejects.toBeInstanceOf(ChatSetupError);
	});

	it("turns a provider error into a safe message, without its body", async () => {
		const failing = new MockLanguageModelV4({
			doStream: async () => {
				throw new APICallError({
					message: "Invalid key sk-or-v1-secretsecret",
					url: "https://openrouter.ai/api/v1/chat/completions",
					requestBodyValues: { messages: "hello" },
					statusCode: 401,
					responseBody: '{"error":"bad key sk-or-v1-secretsecret"}',
					isRetryable: false,
				});
			},
		});
		const chunks = await collect(
			await send(new BrowserChatTransport(async () => failing), SELECTION),
		);
		const error = chunks.find((chunk) => chunk.type === "error");
		expect(error).toEqual({
			type: "error",
			errorText: "OpenRouter rejected the key. Check it in Settings.",
		});
		expect(JSON.stringify(chunks)).not.toContain("secret");
	});
});

describe("resolveProviderModel", () => {
	it("asks for a key in Settings when there isn't one", async () => {
		await expect(resolveProviderModel(SELECTION)).rejects.toThrow(
			"There's no OpenRouter key in this browser. Add one in Settings.",
		);
	});

	it("needs no key for a local server", async () => {
		await expect(
			resolveProviderModel({ provider: "local", model: "qwen" }),
		).resolves.toBeDefined();
	});
});
