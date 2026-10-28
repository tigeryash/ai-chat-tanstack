import type { ModelChoice } from "@/lib/chat/model-selection";
import { useHostFailures } from "@/lib/hosts/host-failures";
import {
	autoHost,
	type ChatNeeds,
	hostOptionsFor,
} from "@/lib/hosts/host-options";
import { useHostPrefs } from "@/lib/hosts/host-prefs";
import { useHostData } from "@/lib/hosts/use-endpoints";
import type { ProviderId } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import { developerName } from "@/lib/models/developers";
import { formatPrice, formatTokens } from "@/lib/models/format";
import {
	CapabilityBadges,
	DataPolicyBadges,
	HighEloBadge,
} from "./model-badges";
import { ModelLogo } from "./model-logo";
import { type CurrentHost, RunWith } from "./run-with";

// The picker's preview card (roadmap 2.2b): the highlighted model's key facts, and "Run with", the
// hosts that can run it. Live host data loads here, while the picker is open.

export function ModelPreview({
	model,
	choice,
	connected,
	needs,
	onChoose,
}: {
	model: CatalogModel;
	/** The chat's resolved choice. */
	choice: ModelChoice | null;
	connected: ReadonlySet<ProviderId> | null;
	needs: ChatNeeds;
	onChoose: (choice: ModelChoice, close: boolean) => void;
}) {
	const data = useHostData(model, true);
	const failures = useHostFailures();
	const [prefs, setPrefs] = useHostPrefs();
	const hosts = hostOptionsFor({
		model,
		connected: connected ?? new Set(),
		data,
		failures,
		prefs,
		needs,
	});
	const current: CurrentHost | undefined =
		choice?.gatewayId === model.gatewayId
			? {
					provider: choice.provider,
					upstream: choice.upstream,
					auto: choice.autoHost !== false,
				}
			: undefined;
	const input = formatPrice(model.pricing?.input);
	const output = formatPrice(model.pricing?.output);

	return (
		<article
			aria-label={`Preview of ${model.name}`}
			className="grid content-start gap-3 p-3"
		>
			<header className="flex items-start gap-2">
				<ModelLogo developer={model.developer} size={22} className="mt-0.5" />
				<div className="grid gap-0.5">
					<h2 className="flex flex-wrap items-center gap-1.5 font-semibold text-sm">
						{model.name}
						{model.highElo && <HighEloBadge />}
					</h2>
					<p className="text-muted-foreground text-xs">
						{[
							developerName(model.developer),
							input && output && `${input} / ${output}`,
							formatTokens(model.contextWindow) &&
								`${formatTokens(model.contextWindow)} context`,
						]
							.filter(Boolean)
							.join(" · ")}
					</p>
				</div>
			</header>
			<CapabilityBadges model={model} />
			<DataPolicyBadges model={model} />
			<RunWith
				key={model.gatewayId}
				gatewayId={model.gatewayId}
				hosts={hosts}
				autoPick={autoHost(hosts, prefs.autoSort)}
				current={current}
				prefs={prefs}
				onPrefs={setPrefs}
				onChoose={onChoose}
				loading={data.loading}
			/>
		</article>
	);
}
