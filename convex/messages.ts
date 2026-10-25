import { type MutationCtx, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  getConversationIfAccessible,
  getCurrentUser,
  getCurrentUserOrNull,
  requireConversationAccess,
  requireMessageAccess,
  requireOwnAttachment,
  requireOwnMessage,
  requireParentInConversation,
} from "./authHelpers";

// An assistant message's content can change only while its reply is still being written.
const OPEN_ASSISTANT_STATUSES = new Set(["pending", "streaming"]);

/**
 * Attachments linked to a new message must be the sender's own uploads, not yet linked to another
 * message or conversation. Otherwise linking would hand the conversation's members access to them.
 */
async function requireLinkableAttachments(
  ctx: MutationCtx,
  attachmentIds: Id<"attachments">[],
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  for (const attachmentId of attachmentIds) {
    const attachment = await requireOwnAttachment(ctx, attachmentId, userId);
    const linkedElsewhere =
      attachment.messageId !== undefined ||
      (attachment.conversationId !== undefined && attachment.conversationId !== conversationId);
    if (linkedElsewhere) {
      throw new Error("Attachment is already linked to another message");
    }
  }
}

// ============================================================================
// VALIDATORS
// ============================================================================

const messagePartValidator = v.union(
  v.object({
    type: v.literal("text"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  }),
  v.object({
    type: v.literal("tool-invocation"),
    toolCallId: v.string(),
    toolName: v.string(),
    state: v.union(
      v.literal("input-streaming"),
      v.literal("input-available"),
      v.literal("output-available"),
      v.literal("output-error"),
    ),
    input: v.any(),
    output: v.optional(v.any()),
    errorText: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("file"),
    mediaType: v.string(),
    filename: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  }),
  v.object({
    type: v.literal("reasoning"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  }),
  v.object({
    type: v.literal("source"),
    sourceType: v.union(v.literal("url"), v.literal("document")),
    id: v.optional(v.string()),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("step-start"),
    stepNumber: v.optional(v.number()),
  }),
  v.object({
    type: v.literal("image"),
    url: v.string(),
    storageId: v.optional(v.id("_storage")),
    prompt: v.optional(v.string()),
    revisedPrompt: v.optional(v.string()),
  }),
);

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List messages for a conversation
 * Returns messages in chronological order following active branch
 */
export const list = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];

    const conversation = await getConversationIfAccessible(
      ctx,
      args.conversationId,
      user._id,
    );
    if (!conversation) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .take(args.limit ?? 200);

    // Filter out deleted messages and only show active branch
    return messages.filter(
      (m) =>
        !m.deletedAt && (m.isActiveBranch === undefined || m.isActiveBranch),
    );
  },
});

/**
 * Get all messages including branches (for branch navigation)
 */
export const listWithBranches = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await requireConversationAccess(ctx, args.conversationId, user._id);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();

    return messages.filter((m) => !m.deletedAt);
  },
});

/**
 * Get sibling messages (for branch switching)
 */
export const getSiblings = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];

    const message = await requireMessageAccess(ctx, args.messageId, user._id);
    if (!message) return [];

    if (!message.parentId) {
      // Root messages - get all root messages in conversation
      const rootMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", message.conversationId),
        )
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .collect();

      return rootMessages.filter(
        (m) => !m.deletedAt && m.role === message.role,
      );
    }

    // Get siblings with same parent
    const siblings = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentId", message.parentId))
      .collect();

    return siblings.filter((m) => !m.deletedAt);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Send a user message
 */
export const sendUserMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    parts: v.optional(v.array(messagePartValidator)),
    parentId: v.optional(v.id("messages")),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await requireConversationAccess(ctx, args.conversationId, user._id);
    if (args.parentId) {
      await requireParentInConversation(ctx, args.parentId, args.conversationId);
    }
    if (args.attachmentIds) {
      await requireLinkableAttachments(ctx, args.attachmentIds, args.conversationId, user._id);
    }

    const now = Date.now();

    // Build parts array
    const parts = args.parts ?? [{ type: "text" as const, text: args.content }];

    // Handle branching - if parentId specified, calculate branch index
    let branchIndex = 0;
    if (args.parentId) {
      const siblings = await ctx.db
        .query("messages")
        .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
        .collect();

      branchIndex = siblings.filter((s) => !s.deletedAt).length;

      // Deactivate other branches from same parent
      for (const sibling of siblings) {
        if (sibling.isActiveBranch) {
          await ctx.db.patch(sibling._id, { isActiveBranch: false });
        }
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      userId: user._id,
      role: "user",
      parts,
      content: args.content,
      status: "completed",
      parentId: args.parentId,
      branchIndex,
      isActiveBranch: true,
      createdAt: now,
      updatedAt: now,
    });

    // Link attachments to message
    if (args.attachmentIds) {
      for (const attachmentId of args.attachmentIds) {
        await ctx.db.patch(attachmentId, {
          messageId,
          conversationId: args.conversationId,
        });
      }
    }

    // Update conversation
    const conversation = await ctx.db.get(args.conversationId);
    await ctx.db.patch(args.conversationId, {
      messageCount: (conversation?.messageCount ?? 0) + 1,
      lastMessageAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

/**
 * Create a placeholder for AI response (before streaming starts)
 */
export const createAssistantMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    parentId: v.id("messages"),
    model: v.string(),
    modelProvider: v.string(),
    content: v.string(),
    parts: v.array(messagePartValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await requireConversationAccess(ctx, args.conversationId, user._id);
    await requireParentInConversation(ctx, args.parentId, args.conversationId);

    const now = Date.now();

    // Calculate branch index
    const siblings = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    const branchIndex = siblings.filter(
      (s) => !s.deletedAt && s.role === "assistant",
    ).length;

    // Deactivate other assistant responses from same parent
    for (const sibling of siblings) {
      if (sibling.role === "assistant" && sibling.isActiveBranch) {
        await ctx.db.patch(sibling._id, { isActiveBranch: false });
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      userId: user._id,
      role: "assistant",
      parts: args.parts,
      content: args.content,
      status: "pending" as const,
      model: args.model,
      modelProvider: args.modelProvider,
      parentId: args.parentId,
      branchIndex,
      isActiveBranch: true,
      createdAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

/**
 * Update assistant message during/after streaming
 */
export const updateAssistantMessage = mutation({
  args: {
    messageId: v.id("messages"),
    parts: v.optional(v.array(messagePartValidator)),
    content: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("streaming"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
    finishReason: v.optional(
      v.union(
        v.literal("stop"),
        v.literal("length"),
        v.literal("tool-calls"),
        v.literal("content-filter"),
        v.literal("error"),
        v.literal("cancelled"),
      ),
    ),
    latencyMs: v.optional(v.number()),
    hasToolCalls: v.optional(v.boolean()),
    toolCallIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Token usage is not client-writable (audit item 3); it moves to the device in Phase 1.
    const user = await getCurrentUser(ctx);
    const message = await requireOwnMessage(ctx, args.messageId, user._id);
    if (message.role !== "assistant") {
      throw new Error("Can only update assistant messages");
    }
    if (!OPEN_ASSISTANT_STATUSES.has(message.status)) {
      throw new Error("Message is already finished");
    }

    const now = Date.now();

    await ctx.db.patch(args.messageId, {
      ...(args.parts !== undefined && { parts: args.parts }),
      ...(args.content !== undefined && { content: args.content }),
      ...(args.status !== undefined && { status: args.status }),
      ...(args.finishReason !== undefined && { finishReason: args.finishReason }),
      ...(args.latencyMs !== undefined && { latencyMs: args.latencyMs }),
      ...(args.hasToolCalls !== undefined && { hasToolCalls: args.hasToolCalls }),
      ...(args.toolCallIds !== undefined && { toolCallIds: args.toolCallIds }),
      updatedAt: now,
    });
  },
});

/**
 * Edit a user message
 */
export const editUserMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    parts: v.optional(v.array(messagePartValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const message = await requireOwnMessage(ctx, args.messageId, user._id);
    if (message.role !== "user") throw new Error("Can only edit user messages");

    const now = Date.now();

    // Store original content if first edit
    const originalContent = message.originalContent ?? message.content;

    await ctx.db.patch(args.messageId, {
      content: args.content,
      parts: args.parts ?? [{ type: "text", text: args.content }],
      originalContent,
      isEdited: true,
      editedAt: now,
      updatedAt: now,
    });

    return args.messageId;
  },
});

/**
 * Add feedback to assistant message
 */
export const addFeedback = mutation({
  args: {
    messageId: v.id("messages"),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Feedback is one field per message, so only the member who asked for the reply sets it.
    const user = await getCurrentUser(ctx);
    const message = await requireOwnMessage(ctx, args.messageId, user._id);
    if (message.role !== "assistant") {
      throw new Error("Can only add feedback to assistant messages");
    }

    await ctx.db.patch(args.messageId, {
      feedback: {
        rating: args.rating,
        comment: args.comment,
        feedbackAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

/**
 * Soft delete a message
 */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await requireOwnMessage(ctx, args.messageId, user._id);

    await ctx.db.patch(args.messageId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Cancel a streaming response
 */
export const cancelStreaming = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const message = await requireOwnMessage(ctx, args.messageId, user._id);

    if (message.status === "streaming" || message.status === "pending") {
      await ctx.db.patch(args.messageId, {
        status: "cancelled",
        finishReason: "cancelled",
        updatedAt: Date.now(),
      });
    }
  },
});
