import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get or create user from auth token
 * Called on app load / sign in
 */
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      avatarUrl: identity.pictureUrl,
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

/**
 * Get current user
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx. db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
  },
});

/**
 * Update user preferences
 */
export const updatePreferences = mutation({
  args: {
    defaultModel: v.optional(v. string()),
    theme: v.optional(v.union(v. literal("light"), v.literal("dark"), v.literal("system"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      preferences: {
        ...user.preferences,
        ...args,
      },
      updatedAt: Date.now(),
    });
  },
});