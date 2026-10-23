import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";
import {
	convertAISDKPartsToConvex,
	convertAISDKPartToConvex,
	convertConvexPartsToAISDK,
	convertConvexPartToAISDK,
} from "./conversions";

type AISDKPart = UIMessage["parts"][number];
type ConvexMessagePart = Doc<"messages">["parts"][number];

describe("convertConvexPartToAISDK", () => {
	it("keeps text and its streaming state", () => {
		expect(
			convertConvexPartToAISDK({
				type: "text",
				text: "Hello",
				state: "streaming",
			}),
		).toEqual({ type: "text", text: "Hello", state: "streaming" });
	});

	it("keeps reasoning and its state", () => {
		expect(
			convertConvexPartToAISDK({
				type: "reasoning",
				text: "Thinking",
				state: "done",
			}),
		).toEqual({ type: "reasoning", text: "Thinking", state: "done" });
	});

	it("drops the step number from step-start", () => {
		expect(
			convertConvexPartToAISDK({ type: "step-start", stepNumber: 2 }),
		).toEqual({ type: "step-start" });
	});

	it("returns null for part types the UI doesn't render yet", () => {
		const unsupported: ConvexMessagePart[] = [
			{ type: "file", mediaType: "image/png", url: "https://example.com/a" },
			{ type: "source", sourceType: "url", url: "https://example.com" },
			{ type: "image", url: "https://example.com/b.png" },
			{
				type: "tool-invocation",
				toolCallId: "call-1",
				toolName: "search",
				state: "input-available",
				input: {},
			},
		];

		for (const part of unsupported) {
			expect(convertConvexPartToAISDK(part)).toBeNull();
		}
	});
});

describe("convertConvexPartsToAISDK", () => {
	it("returns an empty array when there are no parts", () => {
		expect(convertConvexPartsToAISDK(undefined)).toEqual([]);
		expect(convertConvexPartsToAISDK([])).toEqual([]);
	});

	it("keeps supported parts in order and skips the rest", () => {
		expect(
			convertConvexPartsToAISDK([
				{ type: "step-start" },
				{ type: "reasoning", text: "Plan" },
				{ type: "image", url: "https://example.com/b.png" },
				{ type: "text", text: "Answer", state: "done" },
			]),
		).toEqual([
			{ type: "step-start" },
			{ type: "reasoning", text: "Plan", state: undefined },
			{ type: "text", text: "Answer", state: "done" },
		]);
	});
});

describe("convertAISDKPartToConvex", () => {
	it("stores text and reasoning as done, even mid-stream", () => {
		expect(
			convertAISDKPartToConvex({
				type: "text",
				text: "Partial",
				state: "streaming",
			}),
		).toEqual({ type: "text", text: "Partial", state: "done" });
		expect(
			convertAISDKPartToConvex({
				type: "reasoning",
				text: "Partial",
				state: "streaming",
			}),
		).toEqual({ type: "reasoning", text: "Partial", state: "done" });
	});

	it("keeps step-start", () => {
		expect(convertAISDKPartToConvex({ type: "step-start" })).toEqual({
			type: "step-start",
		});
	});

	it("returns null for part types Convex doesn't store yet", () => {
		const unsupported: AISDKPart[] = [
			{ type: "file", mediaType: "image/png", url: "https://example.com/a" },
			{ type: "source-url", sourceId: "s1", url: "https://example.com" },
		];

		for (const part of unsupported) {
			expect(convertAISDKPartToConvex(part)).toBeNull();
		}
	});
});

describe("convertAISDKPartsToConvex", () => {
	it("returns an empty array when there are no parts", () => {
		expect(convertAISDKPartsToConvex(undefined)).toEqual([]);
	});

	it("round-trips the supported parts", () => {
		const parts: AISDKPart[] = [
			{ type: "step-start" },
			{ type: "reasoning", text: "Plan", state: "done" },
			{ type: "text", text: "Answer", state: "done" },
		];

		expect(convertConvexPartsToAISDK(convertAISDKPartsToConvex(parts))).toEqual(
			parts,
		);
	});
});
