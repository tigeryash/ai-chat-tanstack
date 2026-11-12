import { providerKeyOf } from "./endpoint-stats";
import type { BlockedHost } from "./host-filters";

// Hosts the blocklist suggests (roadmap R2 S3), named the way people know them. `key` is what the
// routers' live data and our direct keys match on (`providerKeyOf`), so one entry blocks the host on
// OpenRouter, AI Gateway and as a direct key. Any other name can be typed; it's normalized the same way.

export const KNOWN_HOSTS: readonly BlockedHost[] = [
	{ key: "alibaba", name: "Alibaba Cloud" },
	{ key: "bedrock", name: "Amazon Bedrock" },
	{ key: "anthropic", name: "Anthropic" },
	{ key: "atlascloud", name: "AtlasCloud" },
	{ key: "azure", name: "Azure" },
	{ key: "baseten", name: "Baseten" },
	{ key: "cerebras", name: "Cerebras" },
	{ key: "chutes", name: "Chutes" },
	{ key: "cohere", name: "Cohere" },
	{ key: "crusoe", name: "Crusoe" },
	{ key: "deepinfra", name: "DeepInfra" },
	{ key: "deepseek", name: "DeepSeek" },
	{ key: "fireworks", name: "Fireworks" },
	{ key: "friendli", name: "FriendliAI" },
	{ key: "gmicloud", name: "GMICloud" },
	{ key: "aistudio", name: "Google AI Studio" },
	{ key: "vertex", name: "Google Vertex" },
	{ key: "groq", name: "Groq" },
	{ key: "huggingface", name: "Hugging Face" },
	{ key: "hyperbolic", name: "Hyperbolic" },
	{ key: "inferencenet", name: "Inference.net" },
	{ key: "minimax", name: "MiniMax" },
	{ key: "mistral", name: "Mistral" },
	{ key: "moonshotai", name: "Moonshot AI" },
	{ key: "nebius", name: "Nebius" },
	{ key: "novita", name: "Novita AI" },
	{ key: "nvidia", name: "NVIDIA" },
	{ key: "openai", name: "OpenAI" },
	{ key: "parasail", name: "Parasail" },
	{ key: "sambanova", name: "SambaNova" },
	{ key: "together", name: "Together AI" },
	{ key: "xai", name: "xAI" },
	{ key: "zai", name: "Z.AI" },
];

/** The host a typed name means: a known one by name or key, else the name as typed. */
export function hostFromName(name: string): BlockedHost | undefined {
	const trimmed = name.trim();
	const key = providerKeyOf(trimmed, "openrouter");
	if (!key) return undefined;
	const known = KNOWN_HOSTS.find(
		(host) =>
			host.name.toLowerCase() === trimmed.toLowerCase() || host.key === key,
	);
	return known ?? { key, name: trimmed };
}
