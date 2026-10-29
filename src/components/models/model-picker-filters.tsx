import { Input } from "@/components/ui/input";
import {
	CAPABILITIES,
	CAPABILITY_LABELS,
	type Capability,
} from "@/lib/models/capabilities";
import { developerName } from "@/lib/models/developers";
import type {
	PickerFilters,
	PickerSort,
	PickerView,
} from "@/lib/models/picker-filter";
import { cn } from "@/lib/utils";

// The picker's search, High Elo / All / Local toggle, filters and sort (roadmap 2.2). The catalog
// filters don't apply to local models, so the Local view shows only the search.

const SELECT_CLASS =
	"h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const CHIP_CLASS =
	"h-6 rounded-full border px-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

/** Blended USD per million tokens (3:1 input to output). */
const PRICE_LIMITS = [1, 5, 15] as const;
const CONTEXT_MINIMUMS = [
	[128_000, "128K+"],
	[200_000, "200K+"],
	[1_000_000, "1M+"],
] as const;
const SORT_LABELS: Record<PickerSort, string> = {
	intelligence: "Intelligence Index",
	price: "Price, low to high",
	newest: "Newest",
};
const VIEW_LABELS: Record<PickerView, string> = {
	"high-elo": "High Elo",
	all: "All models",
	local: "Local",
};

const optionalNumber = (value: string) =>
	value === "" ? undefined : Number(value);

export function ModelPickerFilters({
	filters,
	developers,
	onChange,
}: {
	filters: PickerFilters;
	developers: readonly string[];
	onChange: (filters: PickerFilters) => void;
}) {
	const set = (patch: Partial<PickerFilters>) =>
		onChange({ ...filters, ...patch });
	const toggleCapability = (capability: Capability) =>
		set({
			capabilities: filters.capabilities.includes(capability)
				? filters.capabilities.filter((c) => c !== capability)
				: [...filters.capabilities, capability],
		});

	return (
		<div className="grid gap-2 border-b p-3">
			<div className="flex items-center gap-2">
				<Input
					type="search"
					aria-label="Search models"
					placeholder="Search models"
					value={filters.search}
					autoComplete="off"
					spellCheck={false}
					className="h-8 flex-1"
					onChange={(event) => set({ search: event.target.value })}
				/>
				<fieldset
					aria-label="Which models"
					className="flex rounded-md border p-0.5"
				>
					{(Object.keys(VIEW_LABELS) as PickerView[]).map((view) => (
						<button
							key={view}
							type="button"
							aria-pressed={filters.view === view}
							onClick={() => set({ view })}
							className="h-6 rounded px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:font-medium"
						>
							{VIEW_LABELS[view]}
						</button>
					))}
				</fieldset>
			</div>
			{filters.view !== "local" && (
				<CatalogFilters
					filters={filters}
					developers={developers}
					set={set}
					toggleCapability={toggleCapability}
				/>
			)}
		</div>
	);
}

function CatalogFilters({
	filters,
	developers,
	set,
	toggleCapability,
}: {
	filters: PickerFilters;
	developers: readonly string[];
	set: (patch: Partial<PickerFilters>) => void;
	toggleCapability: (capability: Capability) => void;
}) {
	return (
		<>
			<div className="flex flex-wrap items-center gap-1.5">
				<select
					aria-label="Developer"
					className={SELECT_CLASS}
					value={filters.developer}
					onChange={(event) => set({ developer: event.target.value })}
				>
					<option value="">All developers</option>
					{developers.map((developer) => (
						<option key={developer} value={developer}>
							{developerName(developer)}
						</option>
					))}
				</select>
				<select
					aria-label="Price"
					title="Blended price per million tokens, 3 parts input to 1 part output"
					className={SELECT_CLASS}
					value={filters.maxPrice ?? ""}
					onChange={(event) =>
						set({ maxPrice: optionalNumber(event.target.value) })
					}
				>
					<option value="">Any price</option>
					{PRICE_LIMITS.map((limit) => (
						<option key={limit} value={limit}>
							Under ${limit}/M
						</option>
					))}
				</select>
				<select
					aria-label="Context"
					className={SELECT_CLASS}
					value={filters.minContext ?? ""}
					onChange={(event) =>
						set({ minContext: optionalNumber(event.target.value) })
					}
				>
					<option value="">Any context</option>
					{CONTEXT_MINIMUMS.map(([tokens, label]) => (
						<option key={tokens} value={tokens}>
							{label}
						</option>
					))}
				</select>
				<select
					aria-label="Sort"
					className={cn(SELECT_CLASS, "ml-auto")}
					value={filters.sort}
					onChange={(event) => set({ sort: event.target.value as PickerSort })}
				>
					{(Object.keys(SORT_LABELS) as PickerSort[]).map((sort) => (
						<option key={sort} value={sort}>
							{SORT_LABELS[sort]}
						</option>
					))}
				</select>
			</div>
			<fieldset aria-label="Capabilities" className="flex flex-wrap gap-1">
				{CAPABILITIES.map((capability) => (
					<button
						key={capability}
						type="button"
						aria-pressed={filters.capabilities.includes(capability)}
						onClick={() => toggleCapability(capability)}
						className={CHIP_CLASS}
					>
						{CAPABILITY_LABELS[capability]}
					</button>
				))}
			</fieldset>
		</>
	);
}
