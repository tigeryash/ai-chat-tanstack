import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { createConvexTest, signIn } from "./test.helpers";
import { record } from "./usage";

const USAGE = {
  model: "test-model",
  modelProvider: "test",
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
  costUsd: 0.5,
};

describe("convex/usage.ts record (audit item 3)", () => {
  it("is internal, so clients can't forge usage", () => {
    expect(record.isInternal).toBe(true);
    // Type-level too: clients reach functions through `api`, which no longer has `usage.record`.
    // @ts-expect-error usage.record isn't part of the public API
    const publicReference: unknown = api.usage.record;
    expect(publicReference).toBeDefined(); // `api` is a runtime proxy; the line above is the check.
  });

  it("records usage from server code and adds it to the conversation", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const conversationId = await alice.client.mutation(api.conversations.create, {});

    await t.mutation(internal.usage.record, { ...USAGE, userId: alice.userId!, conversationId });

    expect(await t.run((ctx) => ctx.db.get(conversationId))).toMatchObject({
      totalTokens: 30,
      totalCostUsd: 0.5,
    });
    expect(await alice.client.query(api.usage.getConversationUsage, { conversationId })).toMatchObject(
      { totalRequests: 1, totalTokens: 30 },
    );
  });

  it("refuses to charge a conversation the user can't access", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const alicesConversation = await alice.client.mutation(api.conversations.create, {});

    await expect(
      t.mutation(internal.usage.record, {
        ...USAGE,
        userId: bob.userId!,
        conversationId: alicesConversation,
      }),
    ).rejects.toThrow("Access denied");
    expect(await t.run((ctx) => ctx.db.query("usageEvents").collect())).toEqual([]);
  });
});
