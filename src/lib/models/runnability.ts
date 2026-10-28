import { isProviderId, type ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "./catalog";

// Per-user runnability (roadmap 2.1b, decision 13): a model is runnable when one of the user's
// connected providers serves it. OpenRouter serves anything with an OpenRouter id, a direct key
// serves the models it has a native id for, and the user's own AI Gateway key serves every catalog
// model by its Gateway id.

/** Where a request for a catalog model goes: the provider and that provider's id for the model. */
export interface ModelRoute {
	provider: ProviderId;
	model: string;
}

type RoutableModel = Pick<
	CatalogModel,
	"gatewayId" | "developer" | "nativeIds" | "openRouterId"
>;

/** Gateway developer ids that differ from the key provider's id. */
const DEVELOPER_PROVIDERS: Record<string, ProviderId> = {
	spacexai: "xai",
	moonshotai: "moonshot",
	mistralai: "mistral",
};

function developerProvider(developer: string): ProviderId | undefined {
	const id = DEVELOPER_PROVIDERS[developer] ?? developer;
	return isProviderId(id) ? id : undefined;
}

/** Every way the user can run `model`, best first: OpenRouter, then direct keys, then AI Gateway. */
export function routesFor(
	model: RoutableModel,
	connected: ReadonlySet<ProviderId>,
): ModelRoute[] {
	const routes: ModelRoute[] = [];
	if (model.openRouterId && connected.has("openrouter")) {
		routes.push({ provider: "openrouter", model: model.openRouterId });
	}
	for (const native of model.nativeIds) {
		if (isProviderId(native.provider) && connected.has(native.provider)) {
			routes.push({ provider: native.provider, model: native.modelId });
		}
	}
	if (connected.has("vercel")) {
		routes.push({ provider: "vercel", model: model.gatewayId });
	}
	return routes;
}

/**
 * The provider to suggest connecting for a model nobody connected serves: the developer's own API
 * when it has a native id there, else any direct provider, else OpenRouter, else AI Gateway.
 */
export function providerToConnect(model: RoutableModel): ProviderId {
	const natives = model.nativeIds
		.map((native) => native.provider)
		.filter(isProviderId);
	const own = developerProvider(model.developer);
	if (own && natives.includes(own)) return own;
	if (natives[0]) return natives[0];
	return model.openRouterId ? "openrouter" : "vercel";
}

/**
 * Where to send `model` when no connection serves it: the provider to connect and its id there, so
 * the chat can say what's missing (and works once that key is added).
 */
export function routeToConnect(model: RoutableModel): ModelRoute {
	const provider = providerToConnect(model);
	const native = model.nativeIds.find((id) => id.provider === provider);
	if (native) return { provider, model: native.modelId };
	if (provider === "openrouter" && model.openRouterId) {
		return { provider, model: model.openRouterId };
	}
	return { provider: "vercel", model: model.gatewayId };
}
