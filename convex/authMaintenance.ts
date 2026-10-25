import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { CLEARED_OAUTH_TOKENS } from "./lib/oauthTokens";

const BATCH_SIZE = 100;

type UpdateManyResult = { count: number; isDone: boolean; continueCursor: string };

/**
 * One-off clean-up for roadmap 0.3: blanks the OAuth tokens already stored on Better Auth `account`
 * rows. New writes never store them (`dropOAuthTokens` in convex/auth.ts). Handles one page per run
 * and schedules itself for the next page, so it's safe on any number of rows and safe to re-run.
 *
 * Run by hand, once per deployment:
 *   bunx convex run authMaintenance:clearStoredOAuthTokens
 *   bunx convex run authMaintenance:clearStoredOAuthTokens --prod
 */
export const clearStoredOAuthTokens = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const result: UpdateManyResult = await ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: {
        model: "account",
        // Email/password accounts never hold provider tokens.
        where: [{ field: "providerId", operator: "ne", value: "credential" }],
        update: CLEARED_OAUTH_TOKENS,
      },
      paginationOpts: { cursor: args.cursor ?? null, numItems: BATCH_SIZE },
    });

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.authMaintenance.clearStoredOAuthTokens, {
        cursor: result.continueCursor,
      });
    }

    return { cleared: result.count, isDone: result.isDone };
  },
});
