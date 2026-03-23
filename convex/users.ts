import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, getCurrentUserOrNull } from "./authHelpers";

/**
 * Get or create user from auth token
 * Called on app load / sign in
 */
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user._id;
  },
});

/**
 * Get current user
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx);
  },
});

/**
 * Update user preferences
 */
export const updatePreferences = mutation({
  args: {
    defaultModel: v.optional(v. string()),
    defaultModelProvider: v.optional(v.string()),
    theme: v.optional(v.union(v. literal("light"), v.literal("dark"), v.literal("system"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    await ctx.db.patch(user._id, {
      preferences: {
        ...user.preferences,
        ...args,
      },
      updatedAt: Date.now(),
    });
  },
});