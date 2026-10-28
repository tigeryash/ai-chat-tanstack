import type { UIMessage } from "ai";
import type {
	AutoSort,
	ModelChoice,
	ModelSelection,
} from "@/lib/chat/model-selection";
import type { CatalogModel } from "@/lib/models/catalog";
import { routeToConnect } from "@/lib/models/runnability";
import { autoHost, type ChatNeeds, type HostOption } from "./host-options";
import type { HostPrefs } from "./host-prefs";

// Where a chat's request actually goes (roadmap 2.2b). The stored choice says what the user wants
// (Auto, or a pinned host and upstream); this resolves it against the hosts as they are now, every
// render, so a choice made before keys loaded, or for a key since deleted, lands on a connected host.

/** What the chat's messages need from a host. */
export function chatNeeds(messages: readonly UIMessage[]): ChatNeeds {
	const images = messages.some((message) =>
		message.parts.some(
			(part) => part.type === "file" && part.mediaType.startsWith("image/"),
		),
	);
	return { images };
}

export interface ResolvedHost {
	/** The choice the request uses. */
	choice: ModelChoice;
	/** Its host, when it's one of the model's. */
	option: HostOption | undefined;
}

/**
 * `stored` resolved against `options`. A pinned host the user still has a key for is kept; Auto, or a
 * pinned host that's gone, takes Auto's pick; with nothing connected, the host to connect.
 */
export function resolveHost(
	stored: ModelChoice,
	model: Pick<
		CatalogModel,
		"gatewayId" | "developer" | "nativeIds" | "openRouterId"
	>,
	options: readonly HostOption[],
	sort: AutoSort,
): ResolvedHost {
	if (stored.autoHost === false) {
		const pinned = options.find(
			(option) => option.connected && option.provider === stored.provider,
		);
		if (pinned) {
			return { choice: { ...stored, model: pinned.model }, option: pinned };
		}
	}
	const pick = autoHost(options, sort);
	if (pick) {
		return {
			choice: {
				provider: pick.provider,
				model: pick.model,
				gatewayId: model.gatewayId,
				autoHost: true,
			},
			option: pick,
		};
	}
	const toConnect = routeToConnect(model);
	return {
		choice: { ...toConnect, gatewayId: model.gatewayId, autoHost: true },
		option: options.find((option) => option.provider === toConnect.provider),
	};
}

/** The routing extras a request carries for its host: Auto's sort, the privacy filter, prices. */
export function selectionExtras(
	resolved: ResolvedHost,
	model: Pick<CatalogModel, "pricing"> | undefined,
	prefs: HostPrefs,
): Pick<ModelSelection, "sort" | "noTraining" | "pricing"> {
	const { choice, option } = resolved;
	const pinned = choice.upstream
		? option?.upstreams?.find((upstream) => upstream.slug === choice.upstream)
		: undefined;
	const pricing =
		pinned?.pricing ??
		(option && !option.router ? option.pricing : model?.pricing);
	return {
		sort: choice.upstream ? undefined : prefs.autoSort,
		noTraining: prefs.noTrainingOnly || undefined,
		pricing:
			pricing && (pricing.input !== undefined || pricing.output !== undefined)
				? { input: pricing.input, output: pricing.output }
				: undefined,
	};
}
