import {
	type HighEloCandidate,
	selectHighElo,
} from "../../../src/models/high-elo";

// The probe's view of the catalog (roadmap 2.4a). `models.list` returns slim rows with `highElo`
// and `openRouterId` since 2.2, but a deployment that hasn't been pushed since 2.1 still returns
// whole `models` rows (`openRouter.id`, no `highElo`). Both shapes work here.

export type ProbeCatalogModel = {
	gatewayId: string;
	openRouterId?: string;
	/** USD per million tokens. */
	pricing?: { input?: number; output?: number };
	highElo: boolean;
};

type RawRow = Partial<HighEloCandidate> & {
	gatewayId: string;
	highElo?: boolean;
	openRouterId?: string;
	openRouter?: { id?: string };
	pricing?: { input?: number; output?: number };
};

function isRow(value: unknown): value is RawRow {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as RawRow).gatewayId === "string"
	);
}

export function normalizeCatalog(body: unknown): ProbeCatalogModel[] {
	const list = Array.isArray(body)
		? body
		: (body as { models?: unknown } | null)?.models;
	if (!Array.isArray(list)) throw new Error("Catalog has no models array");
	const rows = list.filter(isRow);
	const flagged = rows.some((row) => typeof row.highElo === "boolean");
	const highElo = flagged
		? new Set(rows.filter((row) => row.highElo).map((row) => row.gatewayId))
		: selectHighElo(
				rows.map((row) => ({
					gatewayId: row.gatewayId,
					pinned: row.pinned === true,
					hidden: row.hidden === true,
					status: row.status ?? "active",
					releasedAt: row.releasedAt,
					artificialAnalysis: row.artificialAnalysis,
				})),
			);
	return rows.map((row) => ({
		gatewayId: row.gatewayId,
		openRouterId: row.openRouterId ?? row.openRouter?.id,
		pricing: row.pricing,
		highElo: highElo.has(row.gatewayId),
	}));
}
