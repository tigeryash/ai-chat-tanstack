import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_CONCURRENT_CHATS = 8;

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
 * Get user's active chat session
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return null;

    const session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) return null;

    // Fetch conversation details for each active chat
    const conversations = await Promise.all(
      session.conversationIds.map((id) => ctx.db.get(id))
    );

    return {
      ... session,
      conversations:  conversations.filter(Boolean),
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Initialize or get active session
 */
export const initialize = mutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    let session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) {
      const sessionId = await ctx.db.insert("activeChatSessions", {
        userId: user._id,
        conversationIds: args.conversationId ? [args. conversationId] : [],
        layout: "single",
        focusedConversationId: args.conversationId,
        updatedAt: Date.now(),
      });

      return sessionId;
    }

    // If a conversation is specified and not already in session, add it
    if (args.conversationId && !session.conversationIds.includes(args.conversationId)) {
      const newIds = [...session.conversationIds, args.conversationId]. slice(
        -MAX_CONCURRENT_CHATS
      );

      await ctx.db.patch(session._id, {
        conversationIds: newIds,
        focusedConversationId: args.conversationId,
        updatedAt: Date.now(),
      });
    }

    return session._id;
  },
});

/**
 * Add a conversation to active session
 */
export const addChat = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    let session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) {
      await ctx.db.insert("activeChatSessions", {
        userId: user._id,
        conversationIds: [args.conversationId],
        layout: "single",
        focusedConversationId: args.conversationId,
        updatedAt: Date.now(),
      });
      return;
    }

    // Check if already in session
    if (session.conversationIds.includes(args.conversationId)) {
      // Just focus it
      await ctx.db.patch(session._id, {
        focusedConversationId:  args.conversationId,
        updatedAt: Date.now(),
      });
      return;
    }

    // Check limit
    if (session.conversationIds.length >= MAX_CONCURRENT_CHATS) {
      throw new Error(`Maximum ${MAX_CONCURRENT_CHATS} concurrent chats allowed`);
    }

    // Add to session
    await ctx.db.patch(session._id, {
      conversationIds: [...session.conversationIds, args.conversationId],
      focusedConversationId: args.conversationId,
      layout: getLayoutForCount(session.conversationIds.length + 1),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Remove a conversation from active session
 */
export const removeChat = mutation({
  args: {
    conversationId: v. id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) return;

    const newIds = session.conversationIds. filter((id) => id !== args.conversationId);

    // Update focused if removing focused chat
    let newFocused = session.focusedConversationId;
    if (session.focusedConversationId === args.conversationId) {
      newFocused = newIds[newIds.length - 1];
    }

    await ctx.db.patch(session._id, {
      conversationIds: newIds,
      focusedConversationId: newFocused,
      layout: getLayoutForCount(newIds.length),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set focused conversation
 */
export const setFocus = mutation({
  args: {
    conversationId: v. id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) return;

    await ctx.db.patch(session._id, {
      focusedConversationId: args.conversationId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update layout
 */
export const setLayout = mutation({
  args:  {
    layout: v.union(
      v.literal("single"),
      v.literal("split-2"),
      v.literal("split-3"),
      v.literal("split-4"),
      v.literal("grid-4"),
      v.literal("grid-6"),
      v.literal("grid-8")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) return;

    await ctx.db.patch(session._id, {
      layout: args.layout,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clear all active chats
 */
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const session = await ctx.db
      .query("activeChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!session) return;

    await ctx.db.patch(session._id, {
      conversationIds: [],
      focusedConversationId: undefined,
      layout: "single",
      updatedAt: Date. now(),
    });
  },
});

// ============================================================================
// HELPERS
// ============================================================================

function getLayoutForCount(
  count: number
): "single" | "split-2" | "split-3" | "split-4" | "grid-4" | "grid-6" | "grid-8" {
  if (count <= 1) return "single";
  if (count === 2) return "split-2";
  if (count === 3) return "split-3";
  if (count === 4) return "grid-4";
  if (count <= 6) return "grid-6";
  return "grid-8";
}