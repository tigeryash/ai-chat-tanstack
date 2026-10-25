import { type QueryCtx, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./authHelpers";
import { generateShareId } from "./lib/shareId";

async function findSharedConversation(ctx: QueryCtx, shareId: string) {
  const conversation = await ctx.db
    .query("conversations")
    .withIndex("by_share_id", (q) => q.eq("shareId", shareId))
    .first();

  return conversation?.isShared ? conversation : null;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get a shared conversation by share ID (public - no auth required)
 */
export const getShared = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    const conversation = await findSharedConversation(ctx, args.shareId);
    if (!conversation) {
      return null;
    }

    const owner = await ctx.db.get(conversation.userId);

    // Only what the shared view shows. The system prompt, settings, usage, cost, metadata, and
    // internal IDs stay private to the owner.
    return {
      title: conversation.title,
      model: conversation.model,
      modelProvider: conversation.modelProvider,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      owner: owner ? { name: owner.name, avatarUrl: owner.avatarUrl } : null,
    };
  },
});

/**
 * Get messages for a shared conversation (public - no auth required)
 */
export const getSharedMessages = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    const conversation = await findSharedConversation(ctx, args.shareId);
    if (!conversation) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversation._id)
      )
      .order("asc")
      .collect();

    // Filter to active branch only, exclude deleted. Project to what a viewer renders: no user IDs,
    // usage, feedback, edit history, or metadata.
    return messages
      .filter((m) => !m.deletedAt && (m.isActiveBranch === undefined || m.isActiveBranch))
      .map((m) => ({
        _id: m._id,
        role: m.role,
        parts: m.parts,
        status: m.status,
        model: m.model,
        createdAt: m.createdAt,
      }));
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Enable sharing for a conversation
 */
export const enableSharing = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db. get(args.conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (conversation.userId !== user._id) throw new Error("Access denied");

    // Generate share ID if not exists
    const shareId = conversation.shareId ??  generateShareId();

    await ctx.db.patch(args. conversationId, {
      isShared: true,
      shareId,
      updatedAt: Date. now(),
    });

    return shareId;
  },
});

/**
 * Disable sharing for a conversation
 */
export const disableSharing = mutation({
  args: { conversationId:  v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db. get(args.conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (conversation.userId !== user._id) throw new Error("Access denied");

    await ctx.db.patch(args. conversationId, {
      isShared: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Regenerate share link (invalidates old link)
 */
export const regenerateShareLink = mutation({
  args:  { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (conversation. userId !== user._id) throw new Error("Access denied");

    const newShareId = generateShareId();

    await ctx.db.patch(args.conversationId, {
      shareId: newShareId,
      updatedAt: Date. now(),
    });

    return newShareId;
  },
});

/**
 * Fork a shared conversation (create a copy for the current user)
 */
export const forkSharedConversation = mutation({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const originalConversation = await findSharedConversation(ctx, args.shareId);
    if (!originalConversation) {
      throw new Error("Shared conversation not found");
    }

    const now = Date.now();

    // Create new conversation
    const newConversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      title: originalConversation.title
        ? `${originalConversation.title} (forked)`
        : "Forked conversation",
      model: originalConversation.model,
      modelProvider: originalConversation.modelProvider,
      // The system prompt isn't part of what's shared, so a fork doesn't copy it either.
      status: "active",
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Copy messages (only active branch)
    const originalMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", originalConversation._id)
      )
      .order("asc")
      .collect();

    const activeMessages = originalMessages.filter(
      (m) => !m.deletedAt && (m.isActiveBranch === undefined || m.isActiveBranch)
    );

    // Map old message IDs to new ones for parent references
    const idMap = new Map<Id<"messages">, Id<"messages">>();
    let messageCount = 0;

    for (const message of activeMessages) {
      const newMessageId = await ctx.db.insert("messages", {
        conversationId: newConversationId,
        userId: user._id,
        role: message.role,
        parts: message.parts,
        content: message.content,
        status: "completed",
        model: message.model,
        modelProvider: message.modelProvider,
        parentId: message.parentId ?  idMap.get(message.parentId) : undefined,
        branchIndex: 0,
        isActiveBranch: true,
        createdAt: now,
        updatedAt: now,
      });

      idMap.set(message._id, newMessageId);
      messageCount++;
    }

    // Update conversation message count
    await ctx.db. patch(newConversationId, {
      messageCount,
      lastMessageAt: now,
    });

    return newConversationId;
  },
});