/// <reference types="vite/client" />
// Shared setup for Convex function tests. The two dots in the file name keep Convex from deploying it.
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { api, components } from "./_generated/api";
import schema from "./schema";

// Every function module plus `_generated`, minus tests, helpers, and type declarations: the files
// Convex itself skips for having more than one dot. (The docs' `!(*.*.*)` extglob matches nothing
// in this repo, likely because its path has a space.)
const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.*.ts"]);

export function createConvexTest() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t, "betterAuth");
  return t;
}

export type ConvexTest = ReturnType<typeof createConvexTest>;

/**
 * A Better Auth user with a live session, plus a client acting as them. Pass `withAppUser: false`
 * to skip `users.getOrCreate`, as for someone who has just signed up.
 */
export async function signIn(t: ConvexTest, name: string, { withAppUser = true } = {}) {
  const now = Date.now();
  const email = `${name}@example.test`;
  const { authUserId, sessionId } = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: { name, email, emailVerified: true, createdAt: now, updatedAt: now },
      },
    });
    const session = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: user._id,
          token: `session-${name}`,
          expiresAt: now + 60 * 60 * 1000,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    return { authUserId: user._id as string, sessionId: session._id as string };
  });

  const client = t.withIdentity({ subject: authUserId, sessionId, name, email });
  const userId = withAppUser ? await client.mutation(api.users.getOrCreate, {}) : null;
  return { client, userId, authUserId };
}
