import { mutation } from "./_generated/server";
import { upsertCurrentUser } from "./authHelpers";

/**
 * Get or create user from auth token
 * Called on app load / sign in. The only place a `users` row is created or its profile refreshed.
 */
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await upsertCurrentUser(ctx);
    return user._id;
  },
});
