import { HIGH_ELO_COUNT } from "./curation";

// The High Elo set (roadmap 2.1b, decision 14): the top HIGH_ELO_COUNT language models by Artificial
// Analysis Intelligence Index, plus curated pins. Computed by `models.list` from the synced table.
//
// Imported by Convex, so keep this file free of `@/` imports.

export interface HighEloCandidate {
	gatewayId: string;
	pinned: boolean;
	hidden: boolean;
	status: "active" | "removed";
	releasedAt?: number;
	artificialAnalysis?: { modelId: string; intelligenceIndex?: number };
}

/**
 * Gateway ids in the High Elo view. Serving variants share their base model's score, so each scored
 * model takes one slot (the newest id with that score). Models without a score only get in by a pin.
 */
export function selectHighElo(
	rows: readonly HighEloCandidate[],
	count: number = HIGH_ELO_COUNT,
): Set<string> {
	const candidates = rows.filter(
		(row) => row.status === "active" && !row.hidden,
	);
	const chosen = new Set(
		candidates.filter((row) => row.pinned).map((row) => row.gatewayId),
	);
	const ranked = candidates
		.filter(
			(row) =>
				!row.pinned && row.artificialAnalysis?.intelligenceIndex !== undefined,
		)
		.sort(
			(a, b) =>
				(b.artificialAnalysis?.intelligenceIndex ?? 0) -
					(a.artificialAnalysis?.intelligenceIndex ?? 0) ||
				(b.releasedAt ?? 0) - (a.releasedAt ?? 0) ||
				a.gatewayId.localeCompare(b.gatewayId),
		);
	const scoredModels = new Set(
		candidates
			.filter((row) => row.pinned)
			.flatMap((row) => row.artificialAnalysis?.modelId ?? []),
	);
	let added = 0;
	for (const row of ranked) {
		if (added >= count) break;
		const scoredModel = row.artificialAnalysis?.modelId ?? row.gatewayId;
		if (scoredModels.has(scoredModel)) continue;
		scoredModels.add(scoredModel);
		chosen.add(row.gatewayId);
		added++;
	}
	return chosen;
}
