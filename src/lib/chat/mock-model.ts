import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

// A scripted model for tests (hard rule 6: tests never call a real model). Used by unit tests and by
// the /e2e/chat page, so only test code imports it.

// The provider spec's stream part type; `ai` doesn't re-export it.
type StreamPart =
	Awaited<
		ReturnType<MockLanguageModelV4["doStream"]>
	>["stream"] extends ReadableStream<infer Part>
		? Part
		: never;

export interface MockReply {
	/** Streamed as reasoning, one chunk per entry, before the text. */
	reasoning?: string[];
	/** Streamed as the reply, one chunk per entry. */
	text: string[];
	chunkDelayInMs?: number;
}

function streamParts({ reasoning = [], text }: MockReply) {
	const parts = [
		{ type: "stream-start", warnings: [] },
		...(reasoning.length > 0
			? [
					{ type: "reasoning-start", id: "r1" },
					...reasoning.map((delta) => ({
						type: "reasoning-delta",
						id: "r1",
						delta,
					})),
					{ type: "reasoning-end", id: "r1" },
				]
			: []),
		{ type: "text-start", id: "t1" },
		...text.map((delta) => ({ type: "text-delta", id: "t1", delta })),
		{ type: "text-end", id: "t1" },
		{
			type: "finish",
			finishReason: { unified: "stop", raw: "stop" },
			usage: {
				inputTokens: {
					total: 3,
					noCache: 3,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: { total: 5, text: 5, reasoning: undefined },
			},
		},
	];
	return parts as StreamPart[];
}

/** A model that streams `reply` every time it's called. */
export function mockChatModel(reply: MockReply) {
	return new MockLanguageModelV4({
		provider: "mock",
		modelId: "mock-model",
		doStream: async () => ({
			stream: simulateReadableStream({
				chunks: streamParts(reply),
				chunkDelayInMs: reply.chunkDelayInMs ?? 0,
			}),
		}),
	});
}
