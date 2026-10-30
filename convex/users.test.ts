import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { createConvexTest, signIn } from "./test.helpers";

describe("convex/users.ts getOrCreate", () => {
  it("creates the row for a signed-in user who has none yet", async () => {
    const t = createConvexTest();
    const { client } = await signIn(t, "newcomer", { withAppUser: false });
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);

    const userId = await client.mutation(api.users.getOrCreate, {});

    const row = await t.run((ctx) => ctx.db.get(userId));
    expect(row).toMatchObject({ name: "newcomer", email: "newcomer@example.test" });
  });

  it("returns the existing row instead of inserting a second one", async () => {
    const t = createConvexTest();
    const { client, userId } = await signIn(t, "alice");

    expect(await client.mutation(api.users.getOrCreate, {})).toBe(userId);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
  });

  it("refreshes stale profile fields from Better Auth", async () => {
    const t = createConvexTest();
    const { client, userId, authUserId } = await signIn(t, "alice");
    await t.run((ctx) => ctx.db.patch(userId!, { name: "old name" }));

    await client.mutation(api.users.getOrCreate, {});
    const refreshed = await t.run((ctx) => ctx.db.get(userId!));
    expect(refreshed).toMatchObject({ name: "alice", authUserId });
  });

  it("throws when signed out", async () => {
    const t = createConvexTest();

    await expect(t.mutation(api.users.getOrCreate, {})).rejects.toThrow("Unauthenticated");
  });
});
