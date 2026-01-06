import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const create = mutation({
    args: {
        title: v.string(),
    }, 
    handler: async ( ctx, args) => {
        const identity = await ctx.auth.getUserIdentity()

        if(!identity) {
            throw new Error("Unauthorized")
        }

        const conversationId = await ctx.db.insert("conversations", {
            title: args.title,
            userId: identity.userId,
        })
        return conversationId;
    }
})