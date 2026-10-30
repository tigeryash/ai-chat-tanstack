"use node";

// Node runtime: the models.dev catalog is one ~6 MB JSON document, too much for the default
// runtime's 64 MB action memory once parsed.
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { ARTIFICIAL_ANALYSIS_KEY_ENV } from "./lib/modelCatalog/sources/artificialAnalysis";
import { runCatalogSync, type SyncResult } from "./lib/modelCatalog/sync";

/**
 * Daily model catalog sync (roadmap 2.1), scheduled in convex/crons.ts. Run it by hand with
 *   bunx convex run modelCatalogSync:sync
 * Without ARTIFICIAL_ANALYSIS_API_KEY on the deployment, it skips that source and keeps old scores.
 */
export const sync = internalAction({
	args: {},
	handler: async (ctx): Promise<SyncResult["summary"]> => {
		const now = Date.now();
		const previous = await ctx.runQuery(internal.models.snapshot, {});
		const result = await runCatalogSync({
			now,
			previous,
			artificialAnalysisKey:
				process.env[ARTIFICIAL_ANALYSIS_KEY_ENV] || undefined,
			log: (line) => console.log(line),
			warn: (line) => console.warn(line),
		});
		await ctx.runMutation(internal.models.applySync, {
			rows: result.writes,
			runs: result.runs,
			now,
		});
		return result.summary;
	},
});
