import { z } from "@/lib/zod";
import { PARAMETER_PROBE } from "@/models/curation";
import type { ParameterProbeResults } from "@/models/parameter-probe";
import {
	type NumberParam,
	PARAM_IDS,
	PARAMS,
	REASONING_EFFORTS,
	type ReasoningEffort,
} from "./registry";
import { type ParamRoute, routeParams } from "./routes";

// Which settings a chat's model and host really take (roadmap 2.4b, decision 15). Rules:
// - the route has to be able to send it (routes.ts);
// - local models: what their server kind documents;
// - catalog models: the 2.4a probe when the model was probed ("accepted" only), else the catalog's
//   supported-parameter list (OpenRouter's own list on OpenRouter);
// - reasoning effort offers only the values the catalog lists for the model;
// - no evidence means hidden.
// The probe ran through OpenRouter, but what it caught (Anthropic refusing `temperature` on newer
// models, say) comes from the model, so it's applied on every route.

/** One model's catalog data that the panel needs (Convex `models.parameters`). */
export interface ModelParameterInfo {
	/** AI Gateway's list, OpenRouter's names. */
	supportedParameters: readonly string[];
	/** OpenRouter's own list, when the model is on OpenRouter. */
	openRouterParameters?: readonly string[];
	reasoningOptions: readonly {
		type: string;
		values?: readonly string[];
		min?: number;
		max?: number;
	}[];
}

export const paramSupportSchema = z.object({
	params: z.array(z.enum(PARAM_IDS)),
	reasoningEfforts: z.array(z.enum(REASONING_EFFORTS)),
	reasoningBudget: z.object({ min: z.number(), max: z.number() }).optional(),
});
/** What the panel shows, and what the transport lets through. */
export type ParamSupport = z.infer<typeof paramSupportSchema>;

export const NO_SUPPORT: ParamSupport = { params: [], reasoningEfforts: [] };

export interface SupportInput extends ParamRoute {
	gatewayId?: string;
	/** Undefined while it loads or for models outside the catalog. */
	catalog?: ModelParameterInfo | null;
	/** For tests; the generated probe results otherwise. */
	probe?: ParameterProbeResults;
}

/** The wire names the model is known to take, or undefined when nothing is known. */
function acceptedNames({
	provider,
	gatewayId,
	catalog,
	probe = PARAMETER_PROBE,
}: SupportInput): ReadonlySet<string> | undefined {
	const probed = gatewayId ? probe[gatewayId]?.openrouter : undefined;
	if (probed) {
		return new Set(
			Object.entries(probed.parameters)
				.filter(([, status]) => status === "accepted")
				.map(([name]) => name),
		);
	}
	if (!catalog) return undefined;
	const list =
		provider === "openrouter"
			? (catalog.openRouterParameters ?? catalog.supportedParameters)
			: catalog.supportedParameters;
	return new Set(list);
}

function reasoningEfforts(
	catalog: ModelParameterInfo | null | undefined,
): ReasoningEffort[] {
	const options = catalog?.reasoningOptions ?? [];
	const listed = options.flatMap((option) =>
		option.type === "effort" ? (option.values ?? []) : [],
	);
	if (listed.length === 0) return [];
	// A model that can switch thinking off takes "none" too.
	const canTurnOff = options.some((option) => option.type === "toggle");
	const offered = new Set([...listed, ...(canTurnOff ? ["none"] : [])]);
	return REASONING_EFFORTS.filter((effort) => offered.has(effort));
}

function reasoningBudget(
	catalog: ModelParameterInfo | null | undefined,
): ParamSupport["reasoningBudget"] {
	const option = catalog?.reasoningOptions.find(
		(entry) => entry.type === "budget_tokens",
	);
	if (!option) return undefined;
	const param = PARAMS.reasoningBudget as NumberParam;
	const min = Math.max(option.min ?? param.min, param.min);
	const max = Math.min(option.max ?? param.max, param.max);
	return min <= max ? { min, max } : undefined;
}

export function paramSupport(input: SupportInput): ParamSupport {
	const route = routeParams(input);
	if (input.provider === "local") {
		return {
			params: PARAM_IDS.filter((id) => route.has(id)),
			reasoningEfforts: [],
		};
	}
	const accepted = acceptedNames(input);
	if (!accepted) return NO_SUPPORT;

	const efforts = reasoningEfforts(input.catalog);
	const budget = reasoningBudget(input.catalog);
	const params = PARAM_IDS.filter((id) => {
		if (!route.has(id) || !accepted.has(PARAMS[id].wireName)) return false;
		if (id === "reasoningEffort") return efforts.length > 0;
		if (id === "reasoningBudget") return budget !== undefined;
		return true;
	});
	return {
		params,
		reasoningEfforts: params.includes("reasoningEffort") ? efforts : [],
		...(budget && params.includes("reasoningBudget")
			? { reasoningBudget: budget }
			: {}),
	};
}
