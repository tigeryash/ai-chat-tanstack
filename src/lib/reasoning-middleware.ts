import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

// `ai` no longer re-exports the provider spec types (LanguageModelV2/V3/V4).
type BaseModel = Parameters<typeof wrapLanguageModel>[0]["model"];

// For models that use <think> tags (DeepSeek R1, GLM, etc.)
export function createThinkTagModel(baseModel: BaseModel) {
	return wrapLanguageModel({
		model: baseModel,
		middleware: extractReasoningMiddleware({
			tagName: "think",
		}),
	});
}
