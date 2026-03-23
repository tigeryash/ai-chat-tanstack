import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getCurrentUser,
  getCurrentUserOrNull,
  requireAttachmentAccess,
  requireConversationAccess,
} from "./authHelpers";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Generate upload URL for file uploads
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUser(ctx); // Verify authenticated
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get attachment by ID
 */
export const get = query({
  args: { id: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;

    return await requireAttachmentAccess(ctx, args.id, user._id);
  },
});

/**
 * Get download URL for an attachment
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;

    const attachment = await ctx.db
      .query("attachments")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();

    if (!attachment) return null;
    await requireAttachmentAccess(ctx, attachment._id, user._id);

    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * List attachments for a conversation
 */
export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];

    await requireConversationAccess(ctx, args.conversationId, user._id);

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // Get URLs for each attachment
    return await Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        url: await ctx.storage.getUrl(attachment.storageId),
      }))
    );
  },
});

/**
 * List user's recent attachments (for re-use)
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ??  20);

    return await Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        url: await ctx.storage.getUrl(attachment.storageId),
      }))
    );
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create attachment record after upload
 */
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (args.conversationId) {
      await requireConversationAccess(ctx, args.conversationId, user._id);
    }

    const attachmentId = await ctx.db. insert("attachments", {
      userId: user._id,
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      width: args.width,
      height: args.height,
      conversationId: args.conversationId,
      messageId:  args.messageId,
      createdAt: Date.now(),
    });

    return attachmentId;
  },
});

/**
 * Link attachment to a message (after message is created)
 */
export const linkToMessage = mutation({
  args:  {
    attachmentId: v.id("attachments"),
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const attachment = await requireAttachmentAccess(ctx, args.attachmentId, user._id);
    await requireConversationAccess(ctx, args.conversationId, user._id);

    await ctx.db.patch(args. attachmentId, {
      messageId: args.messageId,
      conversationId: args.conversationId,
    });
  },
});

/**
 * Delete an attachment
 */
export const remove = mutation({
  args: { id: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const attachment = await requireAttachmentAccess(ctx, args.id, user._id);

    // Delete from storage
    await ctx.storage. delete(attachment.storageId);

    // Delete record
    await ctx.db.delete(args.id);
  },
});