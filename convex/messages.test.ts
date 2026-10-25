import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ConvexTest, createConvexTest, signIn } from "./test.helpers";

type Client = Awaited<ReturnType<typeof signIn>>["client"];

async function startConversation(client: Client) {
  const conversationId = await client.mutation(api.conversations.create, {});
  const userMessageId = await client.mutation(api.messages.sendUserMessage, {
    conversationId,
    content: "hello",
  });
  return { conversationId, userMessageId };
}

async function startReply(
  client: Client,
  conversationId: Id<"conversations">,
  parentId: Id<"messages">,
) {
  return await client.mutation(api.messages.createAssistantMessage, {
    conversationId,
    parentId,
    model: "test-model",
    modelProvider: "test",
    content: "",
    parts: [],
  });
}

// Alice owns a group chat that Bob is a member of; Alice has sent a message and started a reply.
async function groupChatWithReply(t: ConvexTest) {
  const alice = await signIn(t, "alice");
  const bob = await signIn(t, "bob");
  const conversationId = await alice.client.mutation(api.groupChats.create, {
    title: "group",
    invitedUserIds: [bob.userId!],
  });
  const userMessageId = await alice.client.mutation(api.messages.sendUserMessage, {
    conversationId,
    content: "hello",
  });
  const replyId = await startReply(alice.client, conversationId, userMessageId);
  return { alice, bob, conversationId, userMessageId, replyId };
}

describe("convex/messages.ts parent messages stay in their conversation", () => {
  it("rejects a parent from another user's conversation and leaves its branches alone", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const victim = await startConversation(alice.client);
    const victimReply = await startReply(alice.client, victim.conversationId, victim.userMessageId);
    const bobsConversation = await bob.client.mutation(api.conversations.create, {});

    await expect(
      bob.client.mutation(api.messages.sendUserMessage, {
        conversationId: bobsConversation,
        content: "hijack",
        parentId: victim.userMessageId,
      }),
    ).rejects.toThrow("Parent message not found");
    await expect(startReply(bob.client, bobsConversation, victim.userMessageId)).rejects.toThrow(
      "Parent message not found",
    );

    const reply = await t.run((ctx) => ctx.db.get(victimReply));
    expect(reply?.isActiveBranch).toBe(true);
  });

  it("still branches from a parent in the same conversation", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const { conversationId, userMessageId } = await startConversation(alice.client);

    const replyId = await startReply(alice.client, conversationId, userMessageId);

    expect((await t.run((ctx) => ctx.db.get(replyId)))?.parentId).toBe(userMessageId);
  });
});

describe("convex/messages.ts assistant replies are written only by the member who started them", () => {
  it("lets the author stream a reply and finish it", async () => {
    const t = createConvexTest();
    const { alice, replyId } = await groupChatWithReply(t);

    await alice.client.mutation(api.messages.updateAssistantMessage, {
      messageId: replyId,
      content: "partial",
      status: "streaming",
    });
    await alice.client.mutation(api.messages.updateAssistantMessage, {
      messageId: replyId,
      content: "done",
      parts: [{ type: "text", text: "done", state: "done" }],
      status: "completed",
    });

    expect(await t.run((ctx) => ctx.db.get(replyId))).toMatchObject({
      content: "done",
      status: "completed",
    });
  });

  it("rejects another member rewriting the reply", async () => {
    const t = createConvexTest();
    const { bob, replyId } = await groupChatWithReply(t);

    await expect(
      bob.client.mutation(api.messages.updateAssistantMessage, {
        messageId: replyId,
        content: "rewritten by bob",
        status: "completed",
      }),
    ).rejects.toThrow("Access denied");
    expect((await t.run((ctx) => ctx.db.get(replyId)))?.content).toBe("");
  });

  it("rejects rewriting a finished reply, even by its author", async () => {
    const t = createConvexTest();
    const { alice, replyId } = await groupChatWithReply(t);
    await alice.client.mutation(api.messages.updateAssistantMessage, {
      messageId: replyId,
      content: "final",
      status: "completed",
    });

    await expect(
      alice.client.mutation(api.messages.updateAssistantMessage, {
        messageId: replyId,
        content: "rewritten later",
      }),
    ).rejects.toThrow("Message is already finished");
    expect((await t.run((ctx) => ctx.db.get(replyId)))?.content).toBe("final");
  });

  it("rejects writing to a user message through the assistant path", async () => {
    const t = createConvexTest();
    const { alice, userMessageId } = await groupChatWithReply(t);

    await expect(
      alice.client.mutation(api.messages.updateAssistantMessage, {
        messageId: userMessageId,
        content: "not a reply",
      }),
    ).rejects.toThrow("Can only update assistant messages");
  });

  it("doesn't accept token usage from the client", async () => {
    const t = createConvexTest();
    const { alice, replyId } = await groupChatWithReply(t);

    await expect(
      alice.client.mutation(api.messages.updateAssistantMessage, {
        messageId: replyId,
        // @ts-expect-error usage is no longer an argument (audit item 3)
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 1_000_000 },
      }),
    ).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(replyId)))?.usage).toBeUndefined();
  });
});

describe("convex/messages.ts members can't change each other's messages", () => {
  it("rejects cancelling or rating another member's reply", async () => {
    const t = createConvexTest();
    const { bob, replyId } = await groupChatWithReply(t);

    await expect(
      bob.client.mutation(api.messages.cancelStreaming, { messageId: replyId }),
    ).rejects.toThrow("Access denied");
    await expect(
      bob.client.mutation(api.messages.addFeedback, { messageId: replyId, rating: "negative" }),
    ).rejects.toThrow("Access denied");

    const reply = await t.run((ctx) => ctx.db.get(replyId));
    expect(reply).toMatchObject({ status: "pending" });
    expect(reply?.feedback).toBeUndefined();
  });

  it("rejects editing or deleting another member's message", async () => {
    const t = createConvexTest();
    const { bob, userMessageId } = await groupChatWithReply(t);

    await expect(
      bob.client.mutation(api.messages.editUserMessage, { messageId: userMessageId, content: "x" }),
    ).rejects.toThrow("Access denied");
    await expect(
      bob.client.mutation(api.messages.remove, { messageId: userMessageId }),
    ).rejects.toThrow("Access denied");

    const message = await t.run((ctx) => ctx.db.get(userMessageId));
    expect(message).toMatchObject({ content: "hello" });
    expect(message?.deletedAt).toBeUndefined();
  });

  it("rejects edits from a member who has left the chat", async () => {
    const t = createConvexTest();
    const { bob, conversationId } = await groupChatWithReply(t);
    const bobsMessage = await bob.client.mutation(api.messages.sendUserMessage, {
      conversationId,
      content: "from bob",
    });
    await bob.client.mutation(api.groupChats.leave, { conversationId });

    await expect(
      bob.client.mutation(api.messages.editUserMessage, { messageId: bobsMessage, content: "x" }),
    ).rejects.toThrow("Access denied");
  });
});
