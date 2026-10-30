import { v } from "convex/values";
import { selectHighElo } from "../src/models/high-elo";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import {
	type ModelRow,
	modelRowValidator,
	sourceRunValidator,
} from "./lib/modelCatalog/validators";
import { toCatalogModel } from "./lib/modelCatalog/view";

// The model catalog (roadmap 2.1, decision 13). Public data, so the queries need no session.
// Written only by the daily sync in convex/modelCatalogSync.ts.

function toRow({ _id, _creationTime, ...row }: Doc<"models">): ModelRow {
	return row;
}

/**
 * The picker's catalog: every model the Gateway lists now, minus curated hides, slimmed to what the
 * picker and model card show, with the High Elo set marked (roadmap 2.1b), plus when each source
 * last answered. Anything that shows `artificialAnalysis` scores must credit
 * https://artificialanalysis.ai (their free API's terms).
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db
			.query("models")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();
		const sources = await ctx.db.query("modelCatalogSources").collect();
		const highElo = selectHighElo(rows);
		return {
			models: rows
				.filter((row) => !row.hidden)
				.map((row) => toCatalogModel(toRow(row), highElo.has(row.gatewayId))),
			sources: sources.map(({ source, lastSyncedAt }) => ({
				source,
				lastSyncedAt,
			})),
		};
	},
});

/**
 * One model by Gateway id, removed or hidden ones included, so an old chat can still show its model
 * (and the removed-model banner). `highElo` is false here; the list query decides the High Elo set.
 */
export const get = query({
	args: { gatewayId: v.string() },
	handler: async (ctx, { gatewayId }) => {
		const row = await ctx.db
			.query("models")
			.withIndex("by_gateway_id", (q) => q.eq("gatewayId", gatewayId))
			.first();
		return row ? toCatalogModel(toRow(row), false) : null;
	},
});

/** The whole table, for the sync to merge over. */
export const snapshot = internalQuery({
	args: {},
	handler: async (ctx): Promise<ModelRow[]> => {
		const rows = await ctx.db.query("models").collect();
		return rows.map(toRow);
	},
});

/**
 * Writes one sync run: upserts the rows that changed (never deletes) and records how each source
 * did. A failed source keeps its `lastSyncedAt`, so the table says how old its data is.
 */
export const applySync = internalMutation({
	args: {
		rows: v.array(modelRowValidator),
		runs: v.array(sourceRunValidator),
		now: v.number(),
	},
	handler: async (ctx, { rows, runs, now }) => {
		for (const row of rows) {
			const existing = await ctx.db
				.query("models")
				.withIndex("by_gateway_id", (q) => q.eq("gatewayId", row.gatewayId))
				.first();
			if (existing) await ctx.db.replace(existing._id, row);
			else await ctx.db.insert("models", row);
		}

		for (const run of runs) {
			const existing = await ctx.db
				.query("modelCatalogSources")
				.withIndex("by_source", (q) => q.eq("source", run.source))
				.first();
			const update = run.ok
				? {
						source: run.source,
						lastAttemptAt: now,
						lastSyncedAt: now,
						itemCount: run.itemCount,
						lastWarning: run.warning,
					}
				: {
						source: run.source,
						lastAttemptAt: now,
						lastSyncedAt: existing?.lastSyncedAt,
						itemCount: existing?.itemCount,
						lastError: run.error,
					};
			if (existing) await ctx.db.replace(existing._id, update);
			else await ctx.db.insert("modelCatalogSources", update);
		}
	},
});
