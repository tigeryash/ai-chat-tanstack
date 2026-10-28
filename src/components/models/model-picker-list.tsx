import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LOCAL_BASE_URL } from "@/lib/chat/language-model";
import type { ModelList } from "@/lib/chat/list-models";
import {
	type ChatProviderId,
	LOCAL_PROVIDER,
	type ModelChoice,
	providerName,
} from "@/lib/chat/model-selection";
import { PROVIDERS } from "@/lib/keys/providers";
import type { CatalogModel } from "@/lib/models/catalog";
import { developerName } from "@/lib/models/developers";
import { formatPrice, formatTokens } from "@/lib/models/format";
import { type ModelRoute, providerToConnect } from "@/lib/models/runnability";
import { cn } from "@/lib/utils";
import { CapabilityBadges, HighEloBadge } from "./model-badges";
import { ModelLogo } from "./model-logo";

// The picker's rows (roadmap 2.2): catalog models (runnable ones pick, the rest link to Settings),
// the local server's models, and a typed model id for anything the catalog doesn't list.

const ROW_CLASS =
	"flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left outline-none";

export interface CatalogEntry {
	model: CatalogModel;
	/** How the user's connections run it; undefined when none do. */
	route?: ModelRoute;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section aria-label={title} className="py-1">
			<h3 className="px-2 py-1 font-medium text-muted-foreground text-xs">
				{title}
			</h3>
			<ul className="grid">{children}</ul>
		</section>
	);
}

function viaLabel(provider: ChatProviderId): string {
	return provider === LOCAL_PROVIDER ? "Local" : providerName(provider);
}

function Facts({ model }: { model: CatalogModel }) {
	const input = formatPrice(model.pricing?.input);
	const output = formatPrice(model.pricing?.output);
	const facts = [
		model.intelligenceIndex !== undefined &&
			`Index ${Math.round(model.intelligenceIndex)}`,
		input && output && `${input} / ${output}`,
		formatTokens(model.contextWindow),
	].filter(Boolean);
	return (
		<span className="shrink-0 text-right text-muted-foreground text-xs tabular-nums">
			{facts.join(" · ")}
		</span>
	);
}

function CatalogRow({
	entry,
	selected,
	onPick,
	onPreview,
}: {
	entry: CatalogEntry;
	selected: boolean;
	onPick: (choice: ModelChoice) => void;
	/** Shows the row's model in the preview card (hover or keyboard focus). */
	onPreview: (gatewayId: string) => void;
}) {
	const preview = () => onPreview(entry.model.gatewayId);
	const { model, route } = entry;
	const body = (
		<>
			<ModelLogo developer={model.developer} className="mt-0.5" />
			<span className="grid min-w-0 flex-1 gap-1">
				<span className="flex flex-wrap items-center gap-1.5">
					<span className="truncate font-medium">{model.name}</span>
					{model.highElo && <HighEloBadge />}
					{selected && <CheckIcon aria-hidden="true" className="size-3.5" />}
				</span>
				<span className="text-muted-foreground text-xs">
					{developerName(model.developer)}
					{route && ` · via ${viaLabel(route.provider)}`}
				</span>
				<CapabilityBadges model={model} />
			</span>
			<Facts model={model} />
		</>
	);

	if (!route) {
		const provider = PROVIDERS[providerToConnect(model)].name;
		return (
			<li
				data-model={model.gatewayId}
				className={cn(ROW_CLASS, "opacity-80")}
				onPointerEnter={preview}
				onFocus={preview}
			>
				{body}
				<Link
					to="/settings"
					className="shrink-0 self-center rounded-md border px-2 py-1 text-xs hover:bg-muted"
				>
					Connect {provider}
				</Link>
			</li>
		);
	}
	return (
		<li data-model={model.gatewayId} onPointerEnter={preview} onFocus={preview}>
			<button
				type="button"
				aria-label={model.name}
				aria-current={selected || undefined}
				onClick={() => onPick({ ...route, gatewayId: model.gatewayId })}
				className={cn(
					ROW_CLASS,
					"hover:bg-muted focus-visible:bg-muted",
					selected && "bg-muted/60",
				)}
			>
				{body}
			</button>
		</li>
	);
}

export function CatalogSection({
	entries,
	choice,
	onPick,
	onPreview,
}: {
	entries: readonly CatalogEntry[];
	choice: ModelChoice | null;
	onPick: (choice: ModelChoice) => void;
	onPreview: (gatewayId: string) => void;
}) {
	return (
		<Section title="Models">
			{entries.map((entry) => (
				<CatalogRow
					key={entry.model.gatewayId}
					entry={entry}
					selected={choice?.gatewayId === entry.model.gatewayId}
					onPick={onPick}
					onPreview={onPreview}
				/>
			))}
		</Section>
	);
}

function SimpleRow({
	logo,
	label,
	detail,
	selected,
	onClick,
}: {
	logo: string;
	label: string;
	detail: string;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				aria-label={label}
				aria-current={selected || undefined}
				onClick={onClick}
				className={cn(
					ROW_CLASS,
					"items-center hover:bg-muted focus-visible:bg-muted",
					selected && "bg-muted/60",
				)}
			>
				<ModelLogo developer={logo} />
				<span className="min-w-0 flex-1 truncate font-medium">{label}</span>
				<span className="text-muted-foreground text-xs">{detail}</span>
			</button>
		</li>
	);
}

/** Only what the local server reports: its model ids. */
export function LocalSection({
	list,
	search,
	choice,
	onPick,
}: {
	list: ModelList | null;
	search: string;
	choice: ModelChoice | null;
	onPick: (choice: ModelChoice) => void;
}) {
	const host = new URL(LOCAL_BASE_URL).host;
	const needle = search.trim().toLowerCase();
	const models = list?.ok
		? list.models.filter((model) => model.toLowerCase().includes(needle))
		: [];
	return (
		<Section title="Local">
			{!list && (
				<li className="px-2 py-1 text-muted-foreground text-xs">
					Looking for LM Studio at {host}…
				</li>
			)}
			{list && !list.ok && (
				<li className="px-2 py-1 text-muted-foreground text-xs">
					Couldn't reach LM Studio at {host}. Start its server with CORS
					enabled.
				</li>
			)}
			{models.map((model) => (
				<SimpleRow
					key={model}
					logo={LOCAL_PROVIDER}
					label={model}
					detail={host}
					selected={
						choice?.provider === LOCAL_PROVIDER && choice.model === model
					}
					onClick={() => onPick({ provider: LOCAL_PROVIDER, model })}
				/>
			))}
		</Section>
	);
}

/** Sends the typed text as a model id to a provider, for models the catalog doesn't list. */
export function CustomSection({
	search,
	providers,
	onPick,
}: {
	search: string;
	providers: readonly ChatProviderId[];
	onPick: (choice: ModelChoice) => void;
}) {
	const model = search.trim();
	if (!model) return null;
	return (
		<Section title="Use a model id">
			{providers.map((provider) => (
				<SimpleRow
					key={provider}
					logo={provider}
					label={`Use “${model}” via ${viaLabel(provider)}`}
					detail=""
					selected={false}
					onClick={() => onPick({ provider, model })}
				/>
			))}
		</Section>
	);
}
