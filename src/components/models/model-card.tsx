import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LOCAL_BASE_URL } from "@/lib/chat/language-model";
import { type ChatProviderId, providerName } from "@/lib/chat/model-selection";
import { PROVIDERS } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import { developerName } from "@/lib/models/developers";
import {
	formatCutoff,
	formatMonth,
	formatPrice,
	formatTokens,
} from "@/lib/models/format";
import { providerToConnect } from "@/lib/models/runnability";
import { DataPolicyBadges, HighEloBadge } from "./model-badges";
import { ModelLogo } from "./model-logo";

// What an empty chat shows about its model (roadmap 2.2). Catalog facts come from the daily sync;
// the Intelligence Index is Artificial Analysis's and must be credited to them.

function Fact({ term, children }: { term: string; children: ReactNode }) {
	if (children === undefined || children === null || children === "") {
		return null;
	}
	return (
		<div className="grid gap-0.5">
			<dt className="text-muted-foreground text-xs">{term}</dt>
			<dd className="text-sm">{children}</dd>
		</div>
	);
}

function price(perMillion: number | undefined) {
	const formatted = formatPrice(perMillion);
	return formatted && `${formatted} / M tokens`;
}

export function ModelCard({
	model,
	via,
}: {
	model: CatalogModel;
	/** The connection the chat runs it through; undefined when none of the user's can. */
	via: ChatProviderId | undefined;
}) {
	return (
		<article
			aria-label={`About ${model.name}`}
			className="grid w-full max-w-xl gap-4 rounded-xl border bg-card p-5 text-card-foreground"
		>
			<header className="flex items-start gap-3">
				<ModelLogo developer={model.developer} size={28} />
				<div className="grid flex-1 gap-0.5">
					<h2 className="flex flex-wrap items-center gap-2 font-semibold text-base">
						{model.name}
						{model.highElo && <HighEloBadge />}
					</h2>
					<p className="text-muted-foreground text-sm">
						{developerName(model.developer)}
						{via && ` · via ${providerName(via)}`}
					</p>
				</div>
				{!via && (
					<Link
						to="/settings"
						className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
					>
						Connect {PROVIDERS[providerToConnect(model)].name}
					</Link>
				)}
			</header>
			{model.description && (
				<p className="text-muted-foreground text-sm">{model.description}</p>
			)}
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<Fact term="Context">{formatTokens(model.contextWindow)}</Fact>
				<Fact term="Input price">{price(model.pricing?.input)}</Fact>
				<Fact term="Output price">{price(model.pricing?.output)}</Fact>
				<Fact term="Released">{formatMonth(model.releasedAt)}</Fact>
				<Fact term="Knowledge cutoff">
					{formatCutoff(model.knowledgeCutoff)}
				</Fact>
				<Fact term="Intelligence Index">
					{model.intelligenceIndex !== undefined && (
						<>
							{Math.round(model.intelligenceIndex)}{" "}
							<a
								href="https://artificialanalysis.ai"
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground text-xs underline"
							>
								by Artificial Analysis
							</a>
						</>
					)}
				</Fact>
			</dl>
			{model.providers && model.providers.length > 0 && (
				<Fact term="Providers">{model.providers.join(", ")}</Fact>
			)}
			<DataPolicyBadges model={model} />
		</article>
	);
}

/** A local model: only what the local server reports, which is its id. */
export function LocalModelCard({ model }: { model: string }) {
	return (
		<article
			aria-label={`About ${model}`}
			className="grid w-full max-w-xl gap-1 rounded-xl border bg-card p-5 text-card-foreground"
		>
			<h2 className="flex items-center gap-2 font-semibold text-base">
				<ModelLogo developer="local" size={20} />
				{model}
			</h2>
			<p className="text-muted-foreground text-sm">
				Local · served by {new URL(LOCAL_BASE_URL).host}
			</p>
		</article>
	);
}
