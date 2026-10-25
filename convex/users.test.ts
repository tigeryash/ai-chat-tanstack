import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { createConvexTest, signIn } from "./test.helpers";

describe("convex/users.ts (audit item 1: queries never write)", () => {
  it("returns null for a signed-in user with no users row yet, instead of trying to insert one", async () => {
    const t = createConvexTest();
    const { client } = await signIn(t, "newcomer", { withAppUser: false });

    expect(await client.query(api.users.current, {})).toBeNull();
    expect(await client.query(api.conversations.list, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
  });

  it("creates the row in getOrCreate, which queries then read", async () => {
    const t = createConvexTest();
    const { client, userId } = await signIn(t, "alice");

    const current = await client.query(api.users.current, {});

    expect(current?._id).toBe(userId);
    expect(current).toMatchObject({ name: "alice", email: "alice@example.test" });
  });

  it("refreshes profile fields in getOrCreate, not in queries", async () => {
    const t = createConvexTest();
    const { client, userId, authUserId } = await signIn(t, "alice");
    await t.run((ctx) => ctx.db.patch(userId!, { name: "old name" }));

    // A query sees the stale row and leaves it alone.
    expect((await client.query(api.users.current, {}))?.name).toBe("old name");

    await client.mutation(api.users.getOrCreate, {});
    const refreshed = await t.run((ctx) => ctx.db.get(userId!));
    expect(refreshed).toMatchObject({ name: "alice", authUserId });
  });

  it("returns null when signed out", async () => {
    const t = createConvexTest();

    expect(await t.query(api.users.current, {})).toBeNull();
    await expect(t.mutation(api.users.getOrCreate, {})).rejects.toThrow("Unauthenticated");
  });
});
