import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getCurrentUser,
  getCurrentUserOrNull,
  requireConversationAccess,
  requireMessageAccess,
} from "./authHelpers";

export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return [];

    await requireConversationAccess(ctx, args.conversationId, user._id);

    return await ctx.db
      .query("messagePins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("conversationId"), args.conversationId))
      .collect();
  },
});

export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const message = await requireMessageAccess(ctx, args.messageId, user._id);

    const existingPin = await ctx.db
      .query("messagePins")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", user._id).eq("messageId", args.messageId),
      )
      .first();

    if (existingPin) {
      await ctx.db.delete(existingPin._id);
      return { pinned: false };
    }

    await ctx.db.insert("messagePins", {
      userId: user._id,
      conversationId: message.conversationId,
      messageId: args.messageId,
      createdAt: Date.now(),
    });

    return { pinned: true };
  },
});