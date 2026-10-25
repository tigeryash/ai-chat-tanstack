import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { createConvexTest, signIn } from "./test.helpers";

const SECRET_PROMPT = "private system prompt: never show this";

// Alice's conversation, with private fields filled in, shared by link.
async function sharedConversation() {
  const t = createConvexTest();
  const alice = await signIn(t, "alice");
  const conversationId = await alice.client.mutation(api.conversations.create, {
    title: "Shared chat",
    model: "test-model",
    modelProvider: "test",
    systemPrompt: SECRET_PROMPT,
    settings: { temperature: 0.2, metadata: { private: true } },
  });
  const userMessageId = await alice.client.mutation(api.messages.sendUserMessage, {
    conversationId,
    content: "hello",
  });
  await t.run((ctx) =>
    ctx.db.patch(conversationId, { totalCostUsd: 1.23, metadata: { internal: "yes" } }),
  );
  const shareId = await alice.client.mutation(api.sharing.enableSharing, { conversationId });
  return { t, alice, conversationId, userMessageId, shareId };
}

describe("convex/sharing.ts share links (audit item 4)", () => {
  it("mints a 22-character URL-safe share ID and a new one on regenerate", async () => {
    const { alice, conversationId, shareId } = await sharedConversation();

    const regenerated = await alice.client.mutation(api.sharing.regenerateShareLink, {
      conversationId,
    });

    expect(shareId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(regenerated).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(regenerated).not.toBe(shareId);
  });

  it("shows a signed-out viewer only what the shared page needs", async () => {
    const { t, shareId } = await sharedConversation();

    const shared = await t.query(api.sharing.getShared, { shareId });

    expect(shared).toEqual({
      title: "Shared chat",
      model: "test-model",
      modelProvider: "test",
      createdAt: expect.any(Number),
      lastMessageAt: expect.any(Number),
      owner: { name: "alice", avatarUrl: undefined },
    });
    expect(JSON.stringify(shared)).not.toContain(SECRET_PROMPT);
  });

  it("returns shared messages without user IDs, usage, or feedback", async () => {
    const { t, shareId, userMessageId } = await sharedConversation();

    const messages = await t.query(api.sharing.getSharedMessages, { shareId });

    expect(messages).toHaveLength(1);
    // (Convex drops undefined fields, so a user message has no `model` key at all.)
    for (const key of Object.keys(messages[0])) {
      expect(["_id", "role", "parts", "status", "model", "createdAt"]).toContain(key);
    }
    expect(messages[0]).toMatchObject({ _id: userMessageId, role: "user", parts: expect.any(Array) });
  });

  it("returns nothing once sharing is turned off", async () => {
    const { t, alice, conversationId, shareId } = await sharedConversation();
    await alice.client.mutation(api.sharing.disableSharing, { conversationId });

    expect(await t.query(api.sharing.getShared, { shareId })).toBeNull();
    expect(await t.query(api.sharing.getSharedMessages, { shareId })).toEqual([]);
  });

  it("doesn't copy the system prompt into a fork", async () => {
    const { t, shareId } = await sharedConversation();
    const bob = await signIn(t, "bob");

    const forkId = await bob.client.mutation(api.sharing.forkSharedConversation, { shareId });

    const fork = await t.run((ctx) => ctx.db.get(forkId));
    expect(fork?.userId).toBe(bob.userId);
    expect(fork?.systemPrompt).toBeUndefined();
  });
});
