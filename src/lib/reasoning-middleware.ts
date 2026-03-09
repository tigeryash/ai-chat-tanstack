import {
	extractReasoningMiddleware,
	type LanguageModelV3,
	wrapLanguageModel,
} from "ai";

// For models that use <think> tags (DeepSeek R1, GLM, etc.)
export function createThinkTagModel(baseModel: LanguageModelV3) {
	return wrapLanguageModel({
		model: baseModel,
		middleware: extractReasoningMiddleware({
			tagName: "think",
		}),
	});
}

// For models that use [THINK] tags (Mistral, etc.)
export function createBracketThinkModel(baseModel: LanguageModelV3) {
	return wrapLanguageModel({
		model: baseModel,
		middleware: extractReasoningMiddleware({
			tagName: "THINK",
		}),
	});
}
