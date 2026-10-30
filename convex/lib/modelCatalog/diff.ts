import type { ModelRow } from "./validators";

// What a sync run changed: the rows to write, and a summary for the log.

export type CatalogDiff = {
	added: string[];
	removed: string[];
	restored: string[];
	/** Models whose data changed, with the fields that did. Uptime and sync times alone don't count. */
	changed: { gatewayId: string; fields: string[] }[];
	/** Every new or different row, including ones with only an uptime or sync-time change. */
	writes: ModelRow[];
};

/** JSON with sorted keys, so two equal rows compare equal whatever order their fields were set in. */
export function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, field) =>
		field && typeof field === "object" && !Array.isArray(field)
			? Object.fromEntries(
					Object.entries(field).sort(([a], [b]) => a.localeCompare(b)),
				)
			: field,
	);
}

/** Fields compared for the "changed" list. Uptime moves every day, so it's left out. */
function comparable(row: ModelRow, field: keyof ModelRow): unknown {
	if (field === "providers") {
		return row.providers?.map(({ uptime1d: _uptime, ...provider }) => provider);
	}
	return row[field];
}

const IGNORED_FIELDS = new Set<keyof ModelRow>([
	"providersSyncedAt",
	"status",
	"removedAt",
]);

export function diffCatalog(
	previous: readonly ModelRow[],
	next: readonly ModelRow[],
): CatalogDiff {
	const previousById = new Map(previous.map((row) => [row.gatewayId, row]));
	const diff: CatalogDiff = {
		added: [],
		removed: [],
		restored: [],
		changed: [],
		writes: [],
	};

	for (const row of next) {
		const before = previousById.get(row.gatewayId);
		if (!before) {
			diff.added.push(row.gatewayId);
			diff.writes.push(row);
			continue;
		}
		if (stableStringify(before) === stableStringify(row)) continue;
		diff.writes.push(row);

		if (before.status === "active" && row.status === "removed")
			diff.removed.push(row.gatewayId);
		if (before.status === "removed" && row.status === "active")
			diff.restored.push(row.gatewayId);

		const keys = new Set([
			...Object.keys(before),
			...Object.keys(row),
		] as (keyof ModelRow)[]);
		const fields = [...keys]
			.filter((field) => !IGNORED_FIELDS.has(field))
			.filter(
				(field) =>
					stableStringify(comparable(before, field)) !==
					stableStringify(comparable(row, field)),
			)
			.sort();
		if (fields.length > 0)
			diff.changed.push({ gatewayId: row.gatewayId, fields });
	}
	return diff;
}

const MAX_LISTED = 25;

function list(ids: readonly string[]): string {
	if (ids.length === 0) return "";
	const shown = ids.slice(0, MAX_LISTED).join(", ");
	return ids.length > MAX_LISTED
		? `: ${shown}, and ${ids.length - MAX_LISTED} more`
		: `: ${shown}`;
}

/** One log line per kind of change. Model ids only: the catalog holds no user data. */
export function formatDiff(diff: CatalogDiff): string[] {
	return [
		`new ${diff.added.length}${list(diff.added)}`,
		`removed ${diff.removed.length}${list(diff.removed)}`,
		`restored ${diff.restored.length}${list(diff.restored)}`,
		`changed ${diff.changed.length}${list(diff.changed.map(({ gatewayId, fields }) => `${gatewayId} (${fields.join(", ")})`))}`,
	];
}
