// Display names for Gateway developer ids (`owned_by`). Unknown ids show as given, capitalized.

const DEVELOPER_NAMES: Record<string, string> = {
	alibaba: "Alibaba",
	amazon: "Amazon",
	anthropic: "Anthropic",
	cohere: "Cohere",
	deepseek: "DeepSeek",
	google: "Google",
	meta: "Meta",
	minimax: "MiniMax",
	mistral: "Mistral",
	moonshotai: "Moonshot AI",
	openai: "OpenAI",
	perplexity: "Perplexity",
	spacexai: "xAI",
	xai: "xAI",
	zai: "Z.ai",
};

export function developerName(developer: string): string {
	return (
		DEVELOPER_NAMES[developer] ??
		developer.charAt(0).toUpperCase() + developer.slice(1)
	);
}
