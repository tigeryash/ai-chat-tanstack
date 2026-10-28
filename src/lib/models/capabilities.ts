import type { CatalogModel } from "./catalog";

// Capability badges and filters for the picker (roadmap 2.2), from the Gateway's tags and modalities.

export const CAPABILITIES = [
	"reasoning",
	"vision",
	"files",
	"tools",
	"web-search",
	"open-weights",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
	reasoning: "Reasoning",
	vision: "Vision",
	files: "Files",
	tools: "Tools",
	"web-search": "Web search",
	"open-weights": "Open weights",
};

type CapabilitySource = Pick<CatalogModel, "tags" | "inputModalities">;

export function capabilitiesOf(model: CapabilitySource): Capability[] {
	const tags = new Set(model.tags);
	const inputs = new Set(model.inputModalities);
	const has: Record<Capability, boolean> = {
		reasoning: tags.has("reasoning"),
		vision: tags.has("vision") || inputs.has("image"),
		files: tags.has("file-input") || inputs.has("file"),
		tools: tags.has("tool-use"),
		"web-search": tags.has("web-search"),
		"open-weights": tags.has("open-weights"),
	};
	return CAPABILITIES.filter((capability) => has[capability]);
}
