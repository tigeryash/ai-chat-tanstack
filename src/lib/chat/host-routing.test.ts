// @vitest-environment jsdom
import type { UIMessage, UIMessageChunk } from "ai";
import { beforeEach, describe, expect, it } from "vitest";
import { localHealth, readHostFailures } from "@/lib/hosts/host-failures";
import { BrowserChatTransport } from "./browser-transport";
import { createLanguageModel } from "./language-model";
import type { ModelSelection } from "./model-selection";
import { estimateCost } from "./reply-host";
import { routingOptions } from "./routing-options";

// Roadmap 2.2b: router options reach the request body, and the reply records which host answered.

const KEY = "sk-or-v1-unitTestKey0123456789";
const MESSAGES: UIMessage[] = [
	{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
];

function sse(chunks: object[]): string {
	return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

const OPENROUTER_STREAM = sse([
	{
		id: "gen-1",
		model: "deepseek/x",
		provider: "DeepInfra",
		choices: [{ index: 0, delta: { role: "assistant", content: "Hi" } }],
	},
	{
		id: "gen-1",
		model: "deepseek/x",
		provider: "DeepInfra",
		choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
		usage: {
			prompt_tokens: 10,
			completion_tokens: 2,
			total_tokens: 12,
			cost: 0.000042,
		},
	},
]);

function fakeFetch(status = 200) {
	const bodies: unknown[] = [];
	const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		bodies.push(JSON.parse(String(init?.body)));
		return status === 200
			? new Response(OPENROUTER_STREAM, {
					headers: { "content-type": "text/event-stream" },
				})
			: new Response("{}", { status });
	}) as typeof fetch;
	return { bodies, fetchImpl };
}

async function run(selection: ModelSelection, status = 200) {
	const { bodies, fetchImpl } = fakeFetch(status);
	const transport = new BrowserChatTransport(async (chosen) =>
		createLanguageModel(chosen, KEY, fetchImpl),
	);
	const stream = await transport.sendMessages({
		trigger: "submit-message",
		chatId: "c1",
		messageId: undefined,
		messages: MESSAGES,
		abortSignal: undefined,
		body: selection,
	});
	const chunks: UIMessageChunk[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	const metadata = Object.assign(
		{},
		...chunks.flatMap((chunk) =>
			"messageMetadata" in chunk && chunk.messageMetadata
				? [chunk.messageMetadata]
				: [],
		),
	);
	return { bodies, metadata };
}

beforeEach(() => localStorage.clear());

describe("host routing", () => {
	it("pins an OpenRouter upstream with provider routing, and records who answered", async () => {
		const { bodies, metadata } = await run({
			provider: "openrouter",
			model: "deepseek/x",
			gatewayId: "deepseek/x",
			upstream: "deepinfra/fp8",
		});
		expect(bodies[0]).toMatchObject({
			model: "deepseek/x",
			provider: { order: ["deepinfra/fp8"], allow_fallbacks: false },
			usage: { include: true },
		});
		expect(metadata).toMatchObject({
			provider: "openrouter",
			upstream: "deepinfra/fp8",
			host: "DeepInfra",
			cost: 0.000042,
		});
		expect(metadata.costEstimated).toBeUndefined();
	});

	it("under Auto sends the sort and the no-training filter instead", async () => {
		const { bodies } = await run({
			provider: "openrouter",
			model: "deepseek/x",
			sort: "cheapest",
			noTraining: true,
		});
		expect(bodies[0]).toMatchObject({
			provider: { sort: "price", data_collection: "deny" },
		});
		expect((bodies[0] as { provider: object }).provider).not.toHaveProperty(
			"order",
		);
	});

	it("records a failure against the host, and a success clears it", async () => {
		const pinned = {
			provider: "openrouter",
			model: "deepseek/x",
			upstream: "baseten",
		} as const;
		await run(pinned, 400);
		expect(localHealth(readHostFailures(), "openrouter:baseten")).toBe("slow");
		await run(pinned);
		expect(localHealth(readHostFailures(), "openrouter:baseten")).toBe("up");
	});

	it("gives AI Gateway its order, sort and training options", () => {
		expect(
			routingOptions({ provider: "vercel", model: "a/b", upstream: "baseten" }),
		).toEqual({ gateway: { order: ["baseten"], only: ["baseten"] } });
		expect(
			routingOptions({
				provider: "vercel",
				model: "a/b",
				sort: "fastest",
				noTraining: true,
			}),
		).toEqual({ gateway: { sort: "tps", disallowPromptTraining: true } });
		expect(
			routingOptions({ provider: "vercel", model: "a/b" }),
		).toBeUndefined();
		expect(
			routingOptions({ provider: "fireworks", model: "a/b" }),
		).toBeUndefined();
	});

	it("estimates the cost from catalog prices when the host doesn't bill it", () => {
		expect(
			estimateCost(
				{ inputTokens: 1000, outputTokens: 500 },
				{ input: 1, output: 4 },
			),
		).toBeCloseTo(0.003);
		expect(
			estimateCost({ inputTokens: 1000, outputTokens: 500 }, { input: 1 }),
		).toBe(undefined);
		expect(estimateCost(undefined, { input: 1, output: 1 })).toBeUndefined();
	});
});
