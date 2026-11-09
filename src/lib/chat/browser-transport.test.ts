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

describe("BrowserChatTransport usage (roadmap 2.5)", () => {
	it("records the reply's tokens, TTFT and tokens/sec on its metadata", async () => {
		let tick = 0;
		const now = () => (tick += 100);
		const transport = new BrowserChatTransport(
			async () => mockChatModel({ reasoning: ["hmm"], text: ["Hel", "lo"] }),
			now,
		);
		const chunks = await collect(await send(transport, SELECTION));
		const finish = chunks.find((chunk) => chunk.type === "finish");
		// Started at 100, first token (the reasoning) at 200, finished at 300: 5 tokens in 0.1 s.
		expect(finish).toMatchObject({
			messageMetadata: {
				usage: { inputTokens: 3, outputTokens: 5 },
				ttftMs: 100,
				tokensPerSecond: 50,
			},
		});
	});
});

describe("resolveProviderModel", () => {
	it("asks for a key in Settings when there isn't one", async () => {
		await expect(resolveProviderModel(SELECTION)).rejects.toThrow(
			"There's no OpenRouter key in this browser. Add one in Settings.",
		);
	});

	it("asks for a local server in Settings when none is saved", async () => {
		await expect(
			resolveProviderModel({ provider: "local", model: "qwen" }),
		).rejects.toThrow(
			"Add a local server (LM Studio or Ollama) in Settings first.",
		);
		await expect(
			resolveProviderModel({
				provider: "local",
				model: "qwen",
				endpoint: "ep-gone",
			}),
		).rejects.toThrow("This chat's local server was removed in Settings.");
	});
});

describe("BrowserChatTransport settings (roadmap 2.4b)", () => {
	function recordingModel() {
		const model = mockChatModel({ text: ["ok"] });
		const spy = vi.spyOn(model, "doStream");
		return { model, calls: () => spy.mock.calls.map(([options]) => options) };
	}

	it("applies supported settings and the system prompt, and strips the rest", async () => {
		const { model, calls } = recordingModel();
		await collect(
			await send(new BrowserChatTransport(async () => model), {
				...SELECTION,
				settings: {
					params: { temperature: 0.4, topK: 12, seed: 3, minP: 0.1 },
					support: {
						params: ["temperature", "topK"],
						reasoningEfforts: [],
					},
					systemPrompt: "Be brief.",
				},
			}),
		);
		const [options] = calls();
		expect(options?.temperature).toBe(0.4);
		expect(options?.seed).toBeUndefined();
		expect(options?.providerOptions?.openrouter).toEqual({
			usage: { include: true },
			top_k: 12,
		});
		expect(options?.prompt[0]).toEqual({
			role: "system",
			content: "Be brief.",
		});
	});

	it("sends attached images and PDFs to the model as file parts (roadmap 1.6)", async () => {
		const { model, calls } = recordingModel();
		const png = "data:image/png;base64,iVBORw0KGgo=";
		const pdf = "data:application/pdf;base64,JVBERi0xLjQK";
		await collect(
			await new BrowserChatTransport(async () => model).sendMessages({
				trigger: "submit-message",
				chatId: "c1",
				messageId: undefined,
				abortSignal: undefined,
				body: SELECTION,
				messages: [
					{
						id: "u1",
						role: "user",
						parts: [
							{
								type: "file",
								mediaType: "image/png",
								filename: "a.png",
								url: png,
							},
							{
								type: "file",
								mediaType: "application/pdf",
								filename: "b.pdf",
								url: pdf,
							},
							{ type: "text", text: "What's this?" },
						],
					},
				],
			}),
		);
		const [options] = calls();
		const content = options?.prompt[0]?.content;
		expect(options?.prompt[0]?.role).toBe("user");
		expect(content).toEqual([
			expect.objectContaining({
				type: "file",
				mediaType: "image/png",
				filename: "a.png",
			}),
			expect.objectContaining({
				type: "file",
				mediaType: "application/pdf",
				filename: "b.pdf",
			}),
			expect.objectContaining({ type: "text", text: "What's this?" }),
		]);
	});

	it("sends attached text and code files as text parts, so any model reads them (roadmap 1.6b)", async () => {
		const { model, calls } = recordingModel();
		await collect(
			await new BrowserChatTransport(async () => model).sendMessages({
				trigger: "submit-message",
				chatId: "c1",
				messageId: undefined,
				abortSignal: undefined,
				body: SELECTION,
				messages: [
					{
						id: "u1",
						role: "user",
						parts: [
							{
								type: "file",
								mediaType: "text/plain",
								filename: "main.ts",
								url: `data:text/plain;base64,${btoa("const a = 1;")}`,
							},
							{ type: "text", text: "Review this" },
						],
					},
				],
			}),
		);
		const [options] = calls();
		expect(options?.prompt[0]?.content).toEqual([
			expect.objectContaining({
				type: "text",
				text: "File: main.ts\n```ts\nconst a = 1;\n```",
			}),
			expect.objectContaining({ type: "text", text: "Review this" }),
		]);
	});

	it("sends no settings when the body has none or bad ones", async () => {
		const { model, calls } = recordingModel();
		const transport = new BrowserChatTransport(async () => model);
		await collect(await send(transport, SELECTION));
		await collect(
			await send(transport, {
				...SELECTION,
				settings: { params: { temperature: 99 }, support: "all" },
			}),
		);
		for (const options of calls()) {
			expect(options.temperature).toBeUndefined();
			expect(options.prompt[0]?.role).toBe("user");
		}
	});
});
