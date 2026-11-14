import type { ModelChoice } from "@/lib/chat/model-selection";

// What picking a model row means (roadmap 2.2): the same catalog model keeps the host settings the
// person chose (Auto or a pinned host); another catalog model starts on Auto. Local and typed model ids
// go as they are. The model picker and the palette's "Switch model" page (R2 S7) both pick through it.

export function pickedChoice(
	next: ModelChoice,
	wanted: ModelChoice | null,
): ModelChoice {
	if (next.gatewayId && next.gatewayId === wanted?.gatewayId && wanted) {
		return wanted;
	}
	return next.gatewayId ? { ...next, autoHost: true } : next;
}
