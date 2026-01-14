import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentUser(ctx:  any) {
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
 * List user's conversations for sidebar
 * Returns active conversations sorted by last message time
 */
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return [];

    const status = args.status ??  "active";

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_status", (q) => 
        q.eq("userId", user._id).eq("status", status)
      )
      .order("desc")
      .take(args.limit ??  50);

    // Sort by lastMessageAt (most recent first), then by updatedAt
    return conversations.sort((a, b) => {
      const aTime = a.lastMessageAt ??  a.updatedAt;
      const bTime = b.lastMessageAt ?? b.updatedAt;
      return bTime - aTime;
    });
  },
});

/**
 * Get a single conversation by ID
 */
export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const conversation = await ctx.db. get(args.id);
    if (!conversation) return null;

    // Check access - owner or participant
    const user = await ctx.db
      . query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return null;

    // Direct owner
    if (conversation.userId === user._id) {
      return conversation;
    }

    // Group chat participant
    if (conversation.isGroupChat) {
      const participant = await ctx. db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", args.id)
        )
        .first();

      if (participant && ! participant.leftAt) {
        return conversation;
      }
    }

    // Shared conversation (read-only access)
    if (conversation.isShared) {
      return conversation;
    }

    return null;
  },
});

/**
 * Search conversations by title/content
 */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const searchTerm = args.query. toLowerCase();

    // Get user's conversations
    const conversations = await ctx. db
      .query("conversations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .collect();

    // Filter by title match
    const titleMatches = conversations.filter((c) =>
      c.title?. toLowerCase().includes(searchTerm)
    );

    // For content search, we'd need to search messages
    // This is a simple implementation - for production, consider full-text search
    const conversationIds = new Set(titleMatches.map((c) => c._id));

    // Search in messages
    for (const conv of conversations) {
      if (conversationIds.has(conv._id)) continue;

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .take(100);

      const hasMatch = messages.some((m) =>
        m.content?. toLowerCase().includes(searchTerm)
      );

      if (hasMatch) {
        titleMatches.push(conv);
      }
    }

    return titleMatches. sort((a, b) => {
      const aTime = a. lastMessageAt ?? a.updatedAt;
      const bTime = b.lastMessageAt ?? b. updatedAt;
      return bTime - aTime;
    });
  },
});

/**
 * Get pinned conversations
 */
export const listPinned = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return [];

    const conversations = await ctx.db
      . query("conversations")
      .withIndex("by_user_pinned", (q) =>
        q.eq("userId", user._id).eq("isPinned", true)
      )
      .collect();

    return conversations. filter((c) => c.status === "active");
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new conversation
 * Called when user sends first message
 */
export const create = mutation({
  args: {
    model: v.optional(v.string()),
    modelProvider: v.optional(v. string()),
    systemPrompt: v.optional(v. string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const now = Date.now();

    const conversationId = await ctx.db. insert("conversations", {
      userId: user._id,
      title: args.title,
      model: args.model ??  user.preferences?. defaultModel,
      modelProvider: args.modelProvider,
      systemPrompt: args.systemPrompt,
      status: "active",
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

/**
 * Update conversation title
 */
export const updateTitle = mutation({
  args: {
    id: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args.id);

    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update conversation model
 */
export const updateModel = mutation({
  args: {
    id: v.id("conversations"),
    model: v.string(),
    modelProvider: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args.id);

    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.id, {
      model: args.model,
      modelProvider: args.modelProvider,
      updatedAt:  Date.now(),
    });
  },
});

/**
 * Pin/unpin conversation
 */
export const togglePin = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx. db.get(args.id);

    if (!conversation || conversation. userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args. id, {
      isPinned: !conversation.isPinned,
      updatedAt: Date. now(),
    });
  },
});

/**
 * Archive conversation
 */
export const archive = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args.id);

    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Restore archived conversation
 */
export const restore = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx. db.get(args.id);

    if (!conversation || conversation. userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args. id, {
      status: "active",
      updatedAt:  Date.now(),
    });
  },
});

/**
 * Soft delete conversation
 */
export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx. db.get(args.id);

    if (!conversation || conversation. userId !== user._id) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args. id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Permanently delete conversation and all messages
 * Use with caution!
 */
export const permanentDelete = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args. id);

    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    // Delete all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all attachments
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .collect();

    for (const attachment of attachments) {
      await ctx.storage.delete(attachment.storageId);
      await ctx.db.delete(attachment._id);
    }

    // Delete participants if group chat
    if (conversation.isGroupChat) {
      const participants = await ctx.db
        . query("conversationParticipants")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
        .collect();

      for (const participant of participants) {
        await ctx.db.delete(participant._id);
      }
    }

    // Delete conversation
    await ctx.db.delete(args.id);
  },
});

/**
 * Generate title from first message (call from AI response handler)
 */
export const generateTitle = mutation({
  args:  {
    id: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    if (!conversation) return;

    // Only set title if not already set
    if (!conversation. title) {
      await ctx.db.patch(args. id, {
        title: args.title,
        updatedAt: Date.now(),
      });
    }
  },
});