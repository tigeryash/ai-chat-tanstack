import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { providerName } from "@/lib/chat/model-selection";
import type { HostFeatures } from "@/lib/hosts/endpoint-stats";
import type { HostOption, Upstream } from "@/lib/hosts/host-options";
import {
	formatLatency,
	formatPrice,
	formatSpeed,
	formatTokens,
	formatUptime,
} from "@/lib/models/format";
import { cn } from "@/lib/utils";
import { HostLight } from "./host-light";

// What an expanded "Run with" row shows (roadmap 2.2b): a direct host's details, or a router's
// upstream providers with Auto first.

function Fact({ term, children }: { term: string; children: ReactNode }) {
	return (
		<div className="grid gap-0.5">
			<dt className="text-[0.7rem] text-muted-foreground">{term}</dt>
			<dd className="text-xs tabular-nums">{children ?? "—"}</dd>
		</div>
	);
}

/** "Doesn't train on prompts · Zero retention", or what isn't known. */
export function policyText(
	noTraining: boolean | undefined,
	zdr: boolean | undefined,
): string {
	const parts = [
		noTraining === true && "No training",
		noTraining === false && "May train on prompts",
		zdr === true && "Zero retention",
	].filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join(" · ") : "Data policy not published";
}

const FEATURE_LABELS: [keyof HostFeatures, string][] = [
	["tools", "Tools"],
	["structuredOutput", "Structured output"],
	["images", "Images"],
	["reasoning", "Reasoning"],
];

function Features({ features }: { features: HostFeatures }) {
	const known = FEATURE_LABELS.filter(([key]) => features[key] !== undefined);
	if (known.length === 0) return null;
	return (
		<ul aria-label="Supports" className="flex flex-wrap gap-1">
			{known.map(([key, label]) => (
				<li
					key={key}
					className={cn(
						"rounded border px-1.5 text-[0.65rem]",
						features[key]
							? "text-foreground"
							: "text-muted-foreground line-through",
					)}
				>
					<span className="sr-only">{features[key] ? "Supports " : "No "}</span>
					{label}
				</li>
			))}
		</ul>
	);
}

/** Price in / out, for the collapsed row's summary. */
export function priceText(pricing: { input?: number; output?: number }) {
	const input = formatPrice(pricing.input);
	const output = formatPrice(pricing.output);
	return input && output ? `${input} / ${output}` : undefined;
}

export function DirectHostDetails({
	option,
	onUse,
	selected,
}: {
	option: HostOption;
	onUse?: () => void;
	selected: boolean;
}) {
	const { stats } = option;
	return (
		<div className="grid gap-2">
			<dl className="grid grid-cols-3 gap-2">
				<Fact term="Price in">{formatPrice(option.pricing.input)}</Fact>
				<Fact term="Price out">{formatPrice(option.pricing.output)}</Fact>
				<Fact term="Context">{formatTokens(stats?.contextLength)}</Fact>
				<Fact term="Max output">{formatTokens(stats?.maxOutput)}</Fact>
				<Fact term="Speed">
					{[formatSpeed(option.throughput), formatLatency(option.latencyMs)]
						.filter(Boolean)
						.join(" · ") || undefined}
				</Fact>
				<Fact term="Uptime">{formatUptime(option.uptime)}</Fact>
				<div className="col-span-3">
					<Fact term="Data policy">
						{policyText(option.noTraining, option.zdr)}
					</Fact>
				</div>
			</dl>
			<Features features={option.features} />
			{onUse && (
				<Button
					size="sm"
					variant={selected ? "secondary" : "outline"}
					className="justify-self-start"
					onClick={onUse}
					aria-pressed={selected}
				>
					{selected && <CheckIcon aria-hidden="true" className="size-3.5" />}
					{selected ? "Using" : "Use"} {providerName(option.provider)}
				</Button>
			)}
		</div>
	);
}

function UpstreamRow({
	upstream,
	selected,
	onPick,
}: {
	upstream: Upstream;
	selected: boolean;
	onPick?: () => void;
}) {
	const facts = [
		priceText(upstream.pricing),
		formatLatency(upstream.latencyMs),
		formatSpeed(upstream.throughput),
		formatUptime(upstream.uptime) && `${formatUptime(upstream.uptime)} up`,
	].filter(Boolean);
	return (
		<li>
			<button
				type="button"
				disabled={!onPick}
				onClick={onPick}
				aria-pressed={selected}
				data-upstream={upstream.slug}
				className={cn(
					"grid w-full grid-cols-[auto_1fr] items-center gap-x-2 rounded px-1.5 py-1 text-left text-xs",
					"enabled:hover:bg-muted focus-visible:bg-muted disabled:opacity-60",
					selected && "bg-muted/70",
				)}
			>
				<HostLight state={upstream.health} />
				<span className="flex min-w-0 items-center gap-1.5">
					<span className="truncate font-medium">{upstream.name}</span>
					{selected && <CheckIcon aria-hidden="true" className="size-3" />}
					<span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
						{facts.join(" · ")}
					</span>
				</span>
				<span />
				<span className="text-[0.65rem] text-muted-foreground">
					{upstream.excluded ?? policyText(upstream.noTraining, upstream.zdr)}
				</span>
			</button>
		</li>
	);
}

export function RouterUpstreams({
	option,
	selectedUpstream,
	onPick,
	hideDown,
	loading,
}: {
	option: HostOption;
	/** The pinned upstream; null when Auto is selected, undefined when this router isn't in use. */
	selectedUpstream: string | null | undefined;
	onPick?: (upstream: string | undefined) => void;
	hideDown: boolean;
	loading: boolean;
}) {
	const name = providerName(option.provider);
	const upstreams = (option.upstreams ?? []).filter(
		(upstream) =>
			!hideDown || (upstream.health !== "down" && !upstream.excluded),
	);
	return (
		<div className="grid gap-1">
			<ul
				aria-label={`${name} providers`}
				className="grid max-h-56 gap-0.5 overflow-y-auto"
			>
				<li>
					<button
						type="button"
						disabled={!onPick}
						onClick={() => onPick?.(undefined)}
						aria-pressed={selectedUpstream === null}
						className={cn(
							"flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs",
							"enabled:hover:bg-muted focus-visible:bg-muted disabled:opacity-60",
							selectedUpstream === null && "bg-muted/70",
						)}
					>
						<HostLight state={option.health} />
						<span className="font-medium">
							Auto ({name} picks, falls back if one is down)
						</span>
						{selectedUpstream === null && (
							<CheckIcon aria-hidden="true" className="size-3" />
						)}
					</button>
				</li>
				{upstreams.map((upstream) => (
					<UpstreamRow
						key={upstream.slug}
						upstream={upstream}
						selected={selectedUpstream === upstream.slug}
						onPick={
							onPick && !upstream.excluded
								? () => onPick(upstream.slug)
								: undefined
						}
					/>
				))}
			</ul>
			{loading && !option.upstreams && (
				<p className="text-muted-foreground text-xs">
					Loading {name}'s providers…
				</p>
			)}
			{!loading && !option.upstreams && (
				<p className="text-muted-foreground text-xs">
					Couldn't load {name}'s providers right now. Auto still works.
				</p>
			)}
		</div>
	);
}
