import { XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	PRICE_CAP_MAX,
	type PriceCap,
	useHostFilters,
	withBlockedHost,
} from "@/lib/hosts/host-filters";
import { hostFromName, KNOWN_HOSTS } from "@/lib/hosts/known-hosts";
import {
	MIN_PRECISION_LABELS,
	MIN_PRECISIONS,
	type MinPrecision,
} from "@/lib/hosts/precision";
import type { SettingControlProps } from "./setting-row-props";

// Settings → Models & hosts (roadmap R2 S3): the blocklist, the minimum precision and Auto's price
// cap. Kept in this browser (`host-filters.ts`); the request carries them to the user's own router.

const SELECT_CLASS =
	"h-9 w-48 rounded-md @lg:justify-self-end border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function BlockedHostsControl({
	labelId,
	descriptionId,
}: SettingControlProps) {
	const [filters, update] = useHostFilters();
	const [name, setName] = useState("");
	const inputId = useId();
	const listId = useId();
	const blocked = filters.blockedHosts;
	const suggestions = KNOWN_HOSTS.filter(
		(host) => !blocked.some((entry) => entry.key === host.key),
	);

	const add = (event: FormEvent) => {
		event.preventDefault();
		const host = hostFromName(name);
		if (!host) return;
		update({ blockedHosts: withBlockedHost(blocked, host) });
		setName("");
	};

	return (
		<div className="grid gap-3">
			{blocked.length > 0 ? (
				<ul aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
					{blocked.map((host) => (
						<li
							key={host.key}
							className="flex items-center gap-1 rounded-md border bg-muted py-0.5 pr-0.5 pl-2 text-sm"
						>
							{host.name}
							<Button
								size="icon-xs"
								variant="ghost"
								aria-label={`Unblock ${host.name}`}
								onClick={() =>
									update({
										blockedHosts: blocked.filter(
											(entry) => entry.key !== host.key,
										),
									})
								}
							>
								<XIcon aria-hidden="true" />
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">No hosts blocked.</p>
			)}
			<form onSubmit={add} className="flex flex-wrap items-center gap-2">
				<label htmlFor={inputId} className="sr-only">
					Host to block
				</label>
				<Input
					id={inputId}
					list={listId}
					value={name}
					maxLength={60}
					placeholder="Host name, e.g. DeepInfra"
					aria-describedby={descriptionId}
					onChange={(event) => setName(event.target.value)}
					className="w-64"
				/>
				<datalist id={listId}>
					{suggestions.map((host) => (
						<option key={host.key} value={host.name} />
					))}
				</datalist>
				<Button
					type="submit"
					size="sm"
					variant="outline"
					disabled={!hostFromName(name)}
				>
					Block
				</Button>
			</form>
		</div>
	);
}

export function MinPrecisionSelect({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const [filters, update] = useHostFilters();
	return (
		<select
			id={controlId}
			aria-describedby={descriptionId}
			value={filters.minPrecision}
			onChange={(event) =>
				update({ minPrecision: event.target.value as MinPrecision })
			}
			className={SELECT_CLASS}
		>
			{MIN_PRECISIONS.map((value) => (
				<option key={value} value={value}>
					{MIN_PRECISION_LABELS[value]}
				</option>
			))}
		</select>
	);
}

/** "" for no cap; otherwise a number within range, or undefined when it's not one. */
function parsePrice(text: string): number | null | undefined {
	if (text.trim() === "") return null;
	const value = Number(text);
	return Number.isFinite(value) && value >= 0 && value <= PRICE_CAP_MAX
		? value
		: undefined;
}

function PriceField({
	label,
	side,
	cap,
	onChange,
	describedBy,
}: {
	label: string;
	side: keyof PriceCap;
	cap: PriceCap;
	onChange: (cap: PriceCap) => void;
	describedBy: string;
}) {
	const id = useId();
	const [text, setText] = useState(cap[side]?.toString() ?? "");
	const parsed = parsePrice(text);
	return (
		<div className="grid gap-1">
			<label htmlFor={id} className="text-muted-foreground text-xs">
				{label}
			</label>
			<div className="flex items-center gap-1.5 text-sm">
				<span aria-hidden="true">$</span>
				<Input
					id={id}
					inputMode="decimal"
					value={text}
					placeholder="No cap"
					aria-invalid={parsed === undefined || undefined}
					aria-describedby={describedBy}
					onChange={(event) => {
						setText(event.target.value);
						const next = parsePrice(event.target.value);
						if (next !== undefined) {
							onChange({ ...cap, [side]: next ?? undefined });
						}
					}}
					className="w-28 tabular-nums"
				/>
				<span className="text-muted-foreground">per million tokens</span>
			</div>
		</div>
	);
}

export function PriceCapControl({ descriptionId }: SettingControlProps) {
	const [filters, update] = useHostFilters();
	const onChange = (priceCap: PriceCap) => update({ priceCap });
	return (
		<div className="flex flex-wrap gap-4">
			<PriceField
				label="Input (prompt)"
				side="prompt"
				cap={filters.priceCap}
				onChange={onChange}
				describedBy={descriptionId}
			/>
			<PriceField
				label="Output (completion)"
				side="completion"
				cap={filters.priceCap}
				onChange={onChange}
				describedBy={descriptionId}
			/>
		</div>
	);
}
