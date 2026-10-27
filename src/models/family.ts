// Model families, for suggesting a replacement when a chat's model leaves the catalog (roadmap 2.1b,
// decision 14). A family is the model's name without its version and date parts:
// "anthropic/claude-sonnet-4.5" → "claude-sonnet", "openai/gpt-5.4-mini" → "gpt-mini".
//
// Imported by Convex, so keep this file free of `@/` imports.

/** Version-like name parts: "4", "4.5", "v4.1", "2025", "0528", "4o". */
const VERSION_PART = /^(v?\d+(\.\d+)*[a-z]?|\d{4,})$/i;

export function modelFamily(gatewayId: string): string {
	const name = gatewayId.slice(gatewayId.indexOf("/") + 1).toLowerCase();
	const parts = name.split(/[-_:]/).filter((part) => !VERSION_PART.test(part));
	return parts.join("-") || name;
}

export interface FamilyMember {
	gatewayId: string;
	developer: string;
	releasedAt?: number;
	firstSeenAt?: number;
}

/**
 * The newest model in `active` from the same developer and family as `removed`, or undefined when
 * there's none. Newest by release date, then by when the catalog first saw it.
 */
export function suggestReplacement<T extends FamilyMember>(
	removed: FamilyMember,
	active: readonly T[],
): T | undefined {
	const family = modelFamily(removed.gatewayId);
	const newest = (model: FamilyMember) =>
		model.releasedAt ?? model.firstSeenAt ?? 0;
	return active
		.filter(
			(model) =>
				model.gatewayId !== removed.gatewayId &&
				model.developer === removed.developer &&
				modelFamily(model.gatewayId) === family,
		)
		.sort((a, b) => newest(b) - newest(a))[0];
}
