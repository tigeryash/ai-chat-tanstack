import type { CatalogModel } from "@/lib/models/catalog";
import { z } from "@/lib/zod";

// Deep links to a model comparison (roadmap 3.5): `/new?models=a,b,c` opens one pane per catalog
// model, by Gateway id (`anthropic/claude-opus-5.5`). Route `validateSearch` code isn't code-split
// (quality audit P1), so this module stays light: Zod and a type only. A link names models, never
// keys, prompts or chats.

/** A workspace's pane limit (`MAX_PANES` in storage/workspace.ts, which imports the chat format). */
export const MAX_LINK_PANES = 4;
/** The longest `models` value read; anything longer is ignored. */
const MODELS_PARAM_MAX = 1000;
const MODEL_ID_MAX = 200;
/** Gateway ids are `developer/model`; these characters need no escaping in a query string. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

/**
 * `/new`'s search: `models` as written, or undefined when it's missing or isn't text. A link with a
 * bad value opens a plain new chat rather than an error page.
 */
export const modelLinkSearchSchema = z.object({
	models: z.string().max(MODELS_PARAM_MAX).optional().catch(undefined),
});

/** The model ids in a `models` value, in order: blank and malformed ones dropped, at most MAX_LINK_PANES. */
export function parseModelLink(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((id) => id.trim())
		.filter((id) => id.length <= MODEL_ID_MAX && MODEL_ID.test(id))
		.slice(0, MAX_LINK_PANES);
}

/** The deep link for these Gateway ids, or undefined when none would survive parsing. */
export function modelLinkHref(
	gatewayIds: readonly string[],
	origin: string,
): string | undefined {
	const ids = parseModelLink(gatewayIds.join(","));
	return ids.length > 0 ? `${origin}/new?models=${ids.join(",")}` : undefined;
}

/** The link's ids matched to catalog models, in order; ids the catalog doesn't list are `missing`. */
export function resolveModelLink<Model extends Pick<CatalogModel, "gatewayId">>(
	ids: readonly string[],
	models: readonly Model[],
): { found: Model[]; missing: string[] } {
	const byId = new Map(models.map((model) => [model.gatewayId, model]));
	const found: Model[] = [];
	const missing: string[] = [];
	for (const id of ids) {
		const model = byId.get(id);
		if (model) found.push(model);
		else missing.push(id);
	}
	return { found, missing };
}
