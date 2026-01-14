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
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();

  if (!user) throw new Error("User not found");
  return user;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get branch info for a message
 */
export const getBranchInfo = query({
  args: { messageId: v. id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    // Get all siblings
    let siblings;
    if (message.parentId) {
      siblings = await ctx.db
        .query("messages")
        .withIndex("by_parent", (q) => q.eq("parentId", message. parentId))
        .collect();
    } else {
      // Root level - get all root messages of same role
      siblings = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", message.conversationId)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("parentId"), undefined),
            q.eq(q.field("role"), message.role)
          )
        )
        .collect();
    }

    const validSiblings = siblings
      .filter((s) => !s.deletedAt)
      .sort((a, b) => a.branchIndex!  - b.branchIndex!);

    const currentIndex = validSiblings.findIndex((s) => s._id === args.messageId);

    return {
      totalBranches: validSiblings. length,
      currentBranch: currentIndex + 1,
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex < validSiblings.length - 1,
      previousId: currentIndex > 0 ? validSiblings[currentIndex - 1]._id : null,
      nextId: 
        currentIndex < validSiblings.length - 1
          ? validSiblings[currentIndex + 1]._id
          : null,
      siblings: validSiblings. map((s) => ({
        id: s._id,
        branchIndex: s.branchIndex,
        createdAt: s.createdAt,
        model: s.model,
      })),
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Switch to a different branch
 * Updates isActiveBranch for the entire subtree
 */
export const switchBranch = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const message = await ctx. db.get(args.messageId);

    if (!message) throw new Error("Message not found");

    // Get all siblings
    let siblings;
    if (message.parentId) {
      siblings = await ctx. db
        .query("messages")
        .withIndex("by_parent", (q) => q.eq("parentId", message.parentId))
        .collect();
    } else {
      siblings = await ctx.db
        . query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", message.conversationId)
        )
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .collect();
    }

    // Deactivate all siblings and their subtrees
    for (const sibling of siblings) {
      if (sibling._id !== args.messageId) {
        await deactivateSubtree(ctx, sibling._id);
      }
    }

    // Activate the selected message and its subtree
    await activateSubtree(ctx, args. messageId);

    return args.messageId;
  },
});

/**
 * Create a new branch from a message
 * Used for "regenerate" or "try different approach"
 */
export const createBranch = mutation({
  args: {
    parentId: v.id("messages"),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const parentMessage = await ctx.db.get(args.parentId);

    if (!parentMessage) throw new Error("Parent message not found");

    // This creates a new user message as a branch point
    // The AI response will be generated separately
    if (args.content) {
      const now = Date.now();

      const siblings = await ctx.db
        . query("messages")
        .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
        .collect();

      const branchIndex = siblings.filter((s) => !s.deletedAt).length;

      // Deactivate other branches
      for (const sibling of siblings) {
        if (sibling. isActiveBranch) {
          await deactivateSubtree(ctx, sibling._id);
        }
      }

      const messageId = await ctx.db. insert("messages", {
        conversationId: parentMessage.conversationId,
        userId: user._id,
        role: "user",
        parts: [{ type: "text", text:  args.content }],
        content: args.content,
        status: "completed",
        parentId: args. parentId,
        branchIndex,
        isActiveBranch: true,
        createdAt: now,
        updatedAt: now,
      });

      return messageId;
    }

    // If no content, this is a regeneration request
    // Return the parent ID for the caller to trigger a new generation
    return args.parentId;
  },
});

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function deactivateSubtree(ctx: any, messageId: Id<"messages">) {
  await ctx.db.patch(messageId, { isActiveBranch: false });

  const children = await ctx.db
    . query("messages")
    .withIndex("by_parent", (q) => q.eq("parentId", messageId))
    .collect();

  for (const child of children) {
    await deactivateSubtree(ctx, child._id);
  }
}

async function activateSubtree(ctx: any, messageId:  Id<"messages">) {
  await ctx.db.patch(messageId, { isActiveBranch: true });

  // Find and activate the most recent active child
  const children = await ctx. db
    .query("messages")
    .withIndex("by_parent", (q) => q.eq("parentId", messageId))
    .collect();

  const activeChild = children
    .filter((c) => !c.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (activeChild) {
    await activateSubtree(ctx, activeChild._id);
  }
}