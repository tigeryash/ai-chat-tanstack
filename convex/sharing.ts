import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentUser(ctx: any) {
  const identity = await ctx. auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q:  any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();

  if (!user) throw new Error("User not found");
  return user;
}

function generateShareId(): string {
  // Generate a URL-safe random string
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
    const conversation = await ctx.db
      . query("conversations")
      .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!conversation || ! conversation.isShared) {
      return null;
    }

    // Get owner info (limited)
    const owner = await ctx. db. get(conversation.userId);

    return {
      ...conversation,
      owner: owner
        ? {
            name: owner.name,
            avatarUrl: owner.avatarUrl,
          }
        : null,
    };
  },
});

/**
 * Get messages for a shared conversation (public - no auth required)
 */
export const getSharedMessages = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      . query("conversations")
      .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!conversation || !conversation.isShared) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversation._id)
      )
      .order("asc")
      .collect();

    // Filter to active branch only, exclude deleted
    return messages.filter(
      (m) => !m.deletedAt && (m.isActiveBranch === undefined || m.isActiveBranch)
    );
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

    const originalConversation = await ctx.db
      .query("conversations")
      .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!originalConversation || !originalConversation.isShared) {
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
      systemPrompt: originalConversation. systemPrompt,
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