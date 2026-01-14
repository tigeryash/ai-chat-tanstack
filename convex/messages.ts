import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";

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
      v.literal("output-error")
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
  })
);

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

async function verifyConversationAccess(
  ctx: any,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  // Owner has access
  if (conversation.userId === userId) return conversation;

  // Check group chat participant
  if (conversation.isGroupChat) {
    const participant = await ctx. db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q:  any) =>
        q.eq("userId", userId).eq("conversationId", conversationId)
      )
      .first();

    if (participant && !participant. leftAt) return conversation;
  }

  throw new Error("Access denied");
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List messages for a conversation
 * Returns messages in chronological order following active branch
 */
export const list = query({
  args: {
    conversationId: v. id("conversations"),
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

    // Verify access (allows shared conversations)
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return [];

    const hasAccess =
      conversation.userId === user._id ||
      conversation.isShared ||
      (conversation.isGroupChat &&
        (await ctx.db
          .query("conversationParticipants")
          .withIndex("by_user_conversation", (q) =>
            q.eq("userId", user._id).eq("conversationId", args.conversationId)
          )
          .first()));

    if (!hasAccess) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(args.limit ??  200);

    // Filter out deleted messages and only show active branch
    return messages.filter(
      (m) => !m.deletedAt && (m.isActiveBranch === undefined || m.isActiveBranch)
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
    await verifyConversationAccess(ctx, args.conversationId, user._id);

    const messages = await ctx.db
      . query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args. conversationId)
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
    const message = await ctx.db.get(args.messageId);
    if (!message) return [];

    if (! message.parentId) {
      // Root messages - get all root messages in conversation
      const rootMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", message.conversationId)
        )
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .collect();

      return rootMessages.filter((m) => !m.deletedAt && m.role === message.role);
    }

    // Get siblings with same parent
    const siblings = await ctx. db
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
  args:  {
    conversationId: v.id("conversations"),
    content: v.string(),
    parts: v.optional(v.array(messagePartValidator)),
    parentId: v.optional(v. id("messages")),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await verifyConversationAccess(ctx, args.conversationId, user._id);

    const now = Date.now();

    // Build parts array
    const parts = args. parts ?? [{ type: "text" as const, text: args.content }];

    // Handle branching - if parentId specified, calculate branch index
    let branchIndex = 0;
    if (args. parentId) {
      const siblings = await ctx.db
        .query("messages")
        .withIndex("by_parent", (q) => q.eq("parentId", args. parentId))
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
    await ctx.db.patch(args. conversationId, {
      messageCount: (conversation?.messageCount ??  0) + 1,
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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await verifyConversationAccess(ctx, args.conversationId, user._id);

    const now = Date.now();

    // Calculate branch index
    const siblings = await ctx.db
      . query("messages")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    const branchIndex = siblings.filter(
      (s) => !s.deletedAt && s.role === "assistant"
    ).length;

    // Deactivate other assistant responses from same parent
    for (const sibling of siblings) {
      if (sibling.role === "assistant" && sibling. isActiveBranch) {
        await ctx.db.patch(sibling._id, { isActiveBranch: false });
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      userId: user._id,
      role: "assistant",
      parts: [],
      status: "pending",
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
        v.literal("cancelled")
      )
    ),
    finishReason: v.optional(
      v.union(
        v.literal("stop"),
        v.literal("length"),
        v.literal("tool-calls"),
        v.literal("content-filter"),
        v.literal("error"),
        v.literal("cancelled")
      )
    ),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens:  v.number(),
        totalTokens: v.number(),
        reasoningTokens: v.optional(v.number()),
        cachedTokens: v.optional(v. number()),
      })
    ),
    latencyMs: v.optional(v. number()),
    hasToolCalls: v.optional(v.boolean()),
    toolCallIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const now = Date.now();

    await ctx.db.patch(args. messageId, {
      ...(args.parts && { parts: args.parts }),
      ...(args.content && { content: args.content }),
      ...(args.status && { status: args.status }),
      ...(args.finishReason && { finishReason: args.finishReason }),
      ...(args.usage && { usage: args. usage }),
      ...(args.latencyMs && { latencyMs: args.latencyMs }),
      ...(args.hasToolCalls !== undefined && { hasToolCalls:  args.hasToolCalls }),
      ...(args.toolCallIds && { toolCallIds: args. toolCallIds }),
      updatedAt: now,
    });

    // Update conversation stats if completed
    if (args.status === "completed" && args.usage) {
      const conversation = await ctx.db.get(message.conversationId);
      if (conversation) {
        await ctx.db.patch(message.conversationId, {
          messageCount: (conversation.messageCount ??  0) + 1,
          totalTokens: (conversation.totalTokens ?? 0) + args.usage.totalTokens,
          lastMessageAt: now,
          updatedAt: now,
        });
      }
    }
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
    const message = await ctx.db.get(args.messageId);

    if (!message) throw new Error("Message not found");
    if (message.userId !== user._id) throw new Error("Access denied");
    if (message.role !== "user") throw new Error("Can only edit user messages");

    const now = Date.now();

    // Store original content if first edit
    const originalContent = message.originalContent ?? message.content;

    await ctx.db.patch(args.messageId, {
      content: args.content,
      parts: args.parts ??  [{ type: "text", text: args.content }],
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
    messageId:  v.id("messages"),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const message = await ctx.db.get(args.messageId);

    if (!message) throw new Error("Message not found");
    if (message.role !== "assistant") {
      throw new Error("Can only add feedback to assistant messages");
    }

    await ctx.db.patch(args. messageId, {
      feedback:  {
        rating: args.rating,
        comment: args.comment,
        feedbackAt: Date.now(),
      },
      updatedAt:  Date.now(),
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
    const message = await ctx.db.get(args.messageId);

    if (!message) throw new Error("Message not found");
    if (message.userId !== user._id) throw new Error("Access denied");

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
  args:  { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    if (message.status === "streaming" || message.status === "pending") {
      await ctx.db. patch(args.messageId, {
        status: "cancelled",
        finishReason: "cancelled",
        updatedAt: Date.now(),
      });
    }
  },
});