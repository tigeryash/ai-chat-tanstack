import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q:  any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();

  if (!user) throw new Error("User not found");
  return user;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get user's usage summary
 */
export const getSummary = query({
  args: {
    startDate: v.optional(v. number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      . query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return null;

    const now = Date.now();
    const startDate = args.startDate ??  now - 30 * 24 * 60 * 60 * 1000; // Default 30 days
    const endDate = args.endDate ?? now;

    const usageEvents = await ctx.db
      . query("usageEvents")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).gte("createdAt", startDate))
      .filter((q) => q.lte(q.field("createdAt"), endDate))
      .collect();

    // Aggregate by model
    const byModel:  Record<string, {
      requests: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      costUsd: number;
    }> = {};

    let totalRequests = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const event of usageEvents) {
      totalRequests++;
      totalTokens += event.totalTokens;
      totalCostUsd += event.costUsd;

      if (!byModel[event.model]) {
        byModel[event. model] = {
          requests:  0,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          costUsd: 0,
        };
      }

      byModel[event.model].requests++;
      byModel[event. model].totalTokens += event. totalTokens;
      byModel[event.model].promptTokens += event.promptTokens;
      byModel[event. model].completionTokens += event.completionTokens;
      byModel[event.model].costUsd += event.costUsd;
    }

    return {
      period: { startDate, endDate },
      totalRequests,
      totalTokens,
      totalCostUsd,
      byModel,
    };
  },
});

/**
 * Get usage for a specific conversation
 */
export const getConversationUsage = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const usageEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args. conversationId))
      .collect();

    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const event of usageEvents) {
      totalTokens += event.totalTokens;
      totalCostUsd += event.costUsd;
    }

    return {
      totalRequests: usageEvents.length,
      totalTokens,
      totalCostUsd,
      events: usageEvents,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Record a usage event (called after AI response completes)
 */
export const record = mutation({
  args:  {
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v. id("messages")),
    model: v.string(),
    modelProvider: v.string(),
    promptTokens: v.number(),
    completionTokens: v. number(),
    totalTokens: v.number(),
    reasoningTokens: v.optional(v.number()),
    cachedTokens: v.optional(v. number()),
    costUsd: v.number(),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    await ctx.db.insert("usageEvents", {
      userId: user._id,
      conversationId: args.conversationId,
      messageId: args.messageId,
      model: args.model,
      modelProvider: args. modelProvider,
      promptTokens: args.promptTokens,
      completionTokens: args. completionTokens,
      totalTokens: args.totalTokens,
      reasoningTokens:  args.reasoningTokens,
      cachedTokens: args. cachedTokens,
      costUsd: args.costUsd,
      latencyMs: args.latencyMs,
      createdAt: Date.now(),
    });

    // Update conversation totals if applicable
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (conversation) {
        await ctx.db.patch(args.conversationId, {
          totalTokens: (conversation.totalTokens ?? 0) + args.totalTokens,
          totalCostUsd: (conversation. totalCostUsd ?? 0) + args.costUsd,
        });
      }
    }
  },
});

/**
 * Internal mutation for recording usage from HTTP actions
 */
export const recordInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.id("messages")),
    model: v.string(),
    modelProvider: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    costUsd: v.number(),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageEvents", {
      userId: args.userId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      model: args.model,
      modelProvider: args. modelProvider,
      promptTokens: args.promptTokens,
      completionTokens: args. completionTokens,
      totalTokens: args.totalTokens,
      costUsd: args.costUsd,
      latencyMs: args.latencyMs,
      createdAt: Date.now(),
    });
  },
});