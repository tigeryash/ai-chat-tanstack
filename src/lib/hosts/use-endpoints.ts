import { useQuery } from "@tanstack/react-query";
import { logWarn } from "@/lib/log";
import type { CatalogModel } from "@/lib/models/catalog";
import {
	type EndpointStats,
	parseGatewayEndpoints,
	parseOpenRouterEndpoints,
	withDisplayNames,
	withPolicies,
} from "./endpoint-stats";

// Live host data for the model the picker previews (roadmap 2.2b), fetched from the browser when the
// picker opens and cached a few minutes. Both APIs are public: no key and no chat content is sent,
// only the public model id in the path. Both origins are already in the CSP's provider origins.

export const OPENROUTER_API = "https://openrouter.ai/api/v1";
export const GATEWAY_API = "https://ai-gateway.vercel.sh/v1";

const STALE_MS = 3 * 60 * 1000;

/** "deepseek/deepseek-v4.1-flash" → "deepseek/deepseek-v4.1-flash", each segment encoded. */
function modelPath(id: string): string {
	return id.split("/").map(encodeURIComponent).join("/");
}

async function getJson(url: string): Promise<unknown> {
	const response = await fetch(url, {
		credentials: "omit",
		referrerPolicy: "no-referrer",
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

function endpointsQuery(
	source: "openrouter" | "gateway",
	id: string | undefined,
	enabled: boolean,
) {
	return {
		queryKey: ["host-endpoints", source, id],
		queryFn: async () => {
			try {
				return source === "openrouter"
					? parseOpenRouterEndpoints(
							await getJson(
								`${OPENROUTER_API}/models/${modelPath(id ?? "")}/endpoints`,
							),
						)
					: parseGatewayEndpoints(
							await getJson(
								`${GATEWAY_API}/models/${modelPath(id ?? "")}/endpoints`,
							),
						);
			} catch (error) {
				// Content-free: which source failed and the error's name or status.
				logWarn("Couldn't load host status:", {
					source,
					error: error instanceof Error ? error.message : typeof error,
				});
				throw error;
			}
		},
		enabled: enabled && id !== undefined,
		staleTime: STALE_MS,
		retry: 1,
	};
}

export interface HostData {
	/** OpenRouter's upstreams for the model, with the Gateway's data-policy flags where known. */
	openRouter?: EndpointStats[];
	/** AI Gateway's providers for the model. */
	gateway?: EndpointStats[];
	loading: boolean;
}

/** Live host data for `model`, loaded only while `enabled` (the picker is open). */
export function useHostData(
	model: Pick<CatalogModel, "gatewayId" | "openRouterId"> | undefined,
	enabled: boolean,
): HostData {
	const openRouter = useQuery(
		endpointsQuery("openrouter", model?.openRouterId, enabled),
	);
	const gateway = useQuery(
		endpointsQuery("gateway", model?.gatewayId, enabled),
	);
	return {
		openRouter: openRouter.data && withPolicies(openRouter.data, gateway.data),
		gateway: gateway.data && withDisplayNames(gateway.data, openRouter.data),
		loading: openRouter.isLoading || gateway.isLoading,
	};
}
