import type { UIMessage } from "ai";
import type { Doc } from "../../convex/_generated/dataModel";

type AISDKPart = UIMessage["parts"][number];
type ConvexMessagePart = Doc<"messages">["parts"][number];
type TextPart = Extract<AISDKPart, { type: "text" }>;
type ReasoningPart = Extract<AISDKPart, { type: "reasoning" }>;
type StepStartPart = Extract<AISDKPart, { type: "step-start" }>;

function convertConvexPartToAISDK(part: ConvexMessagePart): AISDKPart | null {
	switch (part.type) {
		case "text":
			return {
				type: "text",
				text: part.text,
				state: part.state,
			} satisfies TextPart;
		case "reasoning":
			return {
				type: "reasoning",
				text: part.text,
				state: part.state,
			} satisfies ReasoningPart;
		case "step-start":
			return { type: "step-start" } satisfies StepStartPart;
		default:
			return null;
	}
}

function convertConvexPartsToAISDK(
	parts: ConvexMessagePart[] | undefined,
): UIMessage["parts"] {
	return parts
		? parts
				.map(convertConvexPartToAISDK)
				.filter((part): part is AISDKPart => part !== null)
		: [];
}

function convertAISDKPartToConvex(part: AISDKPart): ConvexMessagePart | null {
	switch (part.type) {
		case "text":
			return { type: "text", text: part.text, state: "done" };
		case "reasoning":
			return { type: "reasoning", text: part.text, state: "done" };
		case "step-start":
			return { type: "step-start" };
		default:
			return null;
	}
}

function convertAISDKPartsToConvex(
	parts: UIMessage["parts"] | undefined,
): ConvexMessagePart[] {
	return parts
		? parts
				.map(convertAISDKPartToConvex)
				.filter((part): part is ConvexMessagePart => part !== null)
		: [];
}

export {
	convertConvexPartToAISDK,
	convertConvexPartsToAISDK,
	convertAISDKPartToConvex,
	convertAISDKPartsToConvex,
};
