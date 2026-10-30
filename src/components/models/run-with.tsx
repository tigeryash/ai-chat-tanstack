import { Link } from "@tanstack/react-router";
import { useId } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import {
	type AutoSort,
	type ModelChoice,
	providerName,
} from "@/lib/chat/model-selection";
import type { HostOption } from "@/lib/hosts/host-options";
import type { HostPrefs } from "@/lib/hosts/host-prefs";
import { formatSpeed } from "@/lib/models/format";
import { cn } from "@/lib/utils";
import { DirectHostDetails, priceText, RouterUpstreams } from "./host-details";
import { HostLight, LIGHT_LABELS, lightState } from "./host-light";
import { useRunWithRows } from "./use-run-with-rows";

// The picker preview's "Run with" section (roadmap 2.2b): every host that can run the model, as an
// accordion. Auto picks the host (and the router picks its upstream); turning it off, or picking a
// host or upstream, pins this chat to it.

/** Where this chat runs the previewed model now; undefined when another model is previewed. */
export interface CurrentHost {
	provider: string;
	upstream?: string;
	auto: boolean;
}

export interface RunWithProps {
	gatewayId: string;
	hosts: readonly HostOption[];
	/** Auto's pick among `hosts`. */
	autoPick: HostOption | undefined;
	current: CurrentHost | undefined;
	prefs: HostPrefs;
	onPrefs: (change: Partial<HostPrefs>) => void;
	/** `close` when the picker should close (a host or upstream was picked). */
	onChoose: (choice: ModelChoice, close: boolean) => void;
	loading: boolean;
}

/** Read as "Auto picks the cheapest OpenRouter host": the sort only steers OpenRouter's routing. */
const SORT_LABELS: Record<AutoSort, string> = {
	cheapest: "cheapest",
	fastest: "fastest",
	reliable: "most reliable",
};

function summaryOf(option: HostOption) {
	return [priceText(option.pricing), formatSpeed(option.throughput)]
		.filter(Boolean)
		.join(" · ");
}

function SwitchRow({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	const id = useId();
	return (
		<span className="flex items-center gap-1.5">
			<Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} />
			<label htmlFor={id} className="text-xs">
				{label}
			</label>
		</span>
	);
}

export function RunWith({
	gatewayId,
	hosts,
	autoPick,
	current,
	prefs,
	onPrefs,
	onChoose,
	loading,
}: RunWithProps) {
	const sortId = useId();
	const { auto, visible, pin, setAuto } = useRunWithRows({
		gatewayId,
		hosts,
		autoPick,
		current,
		prefs,
		onChoose,
	});

	return (
		<section aria-label="Run with" className="grid gap-2">
			<header className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h3 className="mr-auto font-medium text-sm">Run with</h3>
				<SwitchRow label="Auto" checked={auto} onChange={setAuto} />
				<SwitchRow
					label="Hide unavailable"
					checked={prefs.hideUnavailable}
					onChange={(hideUnavailable) => onPrefs({ hideUnavailable })}
				/>
			</header>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
				<span className="flex items-center gap-1.5">
					<label htmlFor={sortId} className="text-muted-foreground">
						Auto picks the
					</label>
					<select
						id={sortId}
						aria-describedby={`${sortId}-after`}
						value={prefs.autoSort}
						onChange={(event) =>
							onPrefs({ autoSort: event.target.value as AutoSort })
						}
						className="rounded border bg-background px-1 py-0.5"
					>
						{Object.entries(SORT_LABELS).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
					<span id={`${sortId}-after`} className="text-muted-foreground">
						OpenRouter host
					</span>
				</span>
				<SwitchRow
					label="Only hosts that don't train on my data"
					checked={prefs.noTrainingOnly}
					onChange={(noTrainingOnly) => onPrefs({ noTrainingOnly })}
				/>
			</div>
			{visible.length === 0 && (
				<p className="text-muted-foreground text-xs">
					No connected host can run this model right now.{" "}
					<Link to="/settings" className="underline">
						Add a key
					</Link>
					.
				</p>
			)}
			<Accordion className="rounded-md border">
				{visible.map((option) => (
					<HostRow
						key={option.provider}
						option={option}
						isAutoPick={auto && autoPick?.provider === option.provider}
						autoSort={prefs.autoSort}
						current={current}
						hideDown={prefs.hideUnavailable}
						loading={loading}
						onPin={(upstream) => pin(option, upstream)}
					/>
				))}
			</Accordion>
		</section>
	);
}

function HostRow({
	option,
	isAutoPick,
	autoSort,
	current,
	hideDown,
	loading,
	onPin,
}: {
	option: HostOption;
	isAutoPick: boolean;
	autoSort: AutoSort;
	current: CurrentHost | undefined;
	hideDown: boolean;
	loading: boolean;
	onPin: (upstream?: string) => void;
}) {
	const name = providerName(option.provider);
	const inUse = current?.provider === option.provider;
	const usable = option.connected && !option.excluded;
	const summary = summaryOf(option);
	return (
		<AccordionItem
			value={option.provider}
			data-host={option.provider}
			className={cn("px-2", !option.connected && "opacity-70")}
		>
			<div className="flex items-center gap-2">
				<AccordionTrigger
					aria-label={`${name} (${LIGHT_LABELS[lightState(option.health, option.connected)]})`}
					className="items-center gap-2 py-2 hover:no-underline"
				>
					<HostLight state={lightState(option.health, option.connected)} />
					<span className="grid min-w-0 flex-1 gap-0.5">
						<span className="flex items-center gap-1.5">
							<span className="truncate">{name}</span>
							{inUse && (
								<span className="rounded bg-muted px-1 text-[0.65rem]">
									{current.auto ? "In use · Auto" : "In use"}
								</span>
							)}
							{isAutoPick && !inUse && (
								<span className="rounded bg-muted px-1 text-[0.65rem]">
									Auto's pick
								</span>
							)}
						</span>
						<span className="truncate font-normal text-muted-foreground text-xs">
							{option.excluded ?? (summary || "No live data")}
						</span>
					</span>
				</AccordionTrigger>
				{!option.connected && (
					<Link
						to="/settings"
						className="shrink-0 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
					>
						Connect
					</Link>
				)}
			</div>
			<AccordionContent className="pb-2">
				{!option.connected && (
					<p className="mb-2 text-muted-foreground text-xs">
						Add a {name} key in Settings to use it. A key kept for "this session
						only" is gone after a reload; pick "Remember on this device" to keep
						it.
					</p>
				)}
				{option.router ? (
					<RouterUpstreams
						option={option}
						selectedUpstream={inUse ? (current.upstream ?? null) : undefined}
						onPick={usable ? onPin : undefined}
						hideDown={hideDown}
						loading={loading}
						sort={option.provider === "openrouter" ? autoSort : undefined}
						auto={inUse ? !current.upstream : true}
					/>
				) : (
					<DirectHostDetails
						option={option}
						selected={inUse && !current.auto}
						onUse={usable ? () => onPin() : undefined}
					/>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}
