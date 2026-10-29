import { formatCost, formatCostExact } from "@/lib/models/format";
import type { ReplyMetadata } from "./browser-transport";
import { LOCAL_PROVIDER, providerName } from "./model-selection";

// The line under a reply (roadmap 2.2b): short on screen ("via OpenRouter → DeepInfra · $0.0002"),
// with everything recorded in the tooltip. The model is named only when it isn't the chat's model
// now, which the header already shows.

/** The chat's model now, to compare a reply against. */
export interface CurrentModel {
	model: string;
	gatewayId?: string;
}

export interface ReplySummary {
	/** The reply's model id, when it differs from the chat's current model. */
	model?: string;
	/** Its catalog id, for looking up a display name. */
	gatewayId?: string;
	/** "via OpenRouter → DeepInfra", "via Fireworks". */
	route: string;
	/** "$0.0002", "~$0.0002" when estimated. */
	cost?: string;
	/** Every detail, for the tooltip. */
	details: string;
}

function hostName(provider: ReplyMetadata["provider"]): string {
	return provider === LOCAL_PROVIDER ? "Local" : providerName(provider);
}

function sameModel(reply: Partial<ReplyMetadata>, current: CurrentModel) {
	if (reply.gatewayId && current.gatewayId) {
		return reply.gatewayId === current.gatewayId;
	}
	return reply.model === current.model;
}

/** Null for replies saved before metadata was recorded. */
export function replySummary(
	metadata: unknown,
	current: CurrentModel | undefined,
): ReplySummary | null {
	const reply = metadata as Partial<ReplyMetadata> | undefined;
	if (!reply?.provider || !reply.model) return null;
	const provider = hostName(reply.provider);
	const upstream = typeof reply.host === "string" ? reply.host : undefined;
	const cost = typeof reply.cost === "number" ? reply.cost : undefined;
	const short = formatCost(cost);
	// "<$0.0001" is already a bound; "~" only goes on an amount.
	const mark = reply.costEstimated && !short?.startsWith("<") ? "~" : "";
	const exact = formatCostExact(cost);
	const differs = !current || !sameModel(reply, current);
	return {
		...(differs ? { model: reply.model, gatewayId: reply.gatewayId } : {}),
		route: upstream ? `via ${provider} → ${upstream}` : `via ${provider}`,
		...(short ? { cost: `${mark}${short}` } : {}),
		details: [
			reply.model,
			provider,
			upstream && `via ${upstream}`,
			exact &&
				(reply.costEstimated
					? `~${exact} (estimated from list prices)`
					: exact),
		]
			.filter(Boolean)
			.join(" · "),
	};
}
