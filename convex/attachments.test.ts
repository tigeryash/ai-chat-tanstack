import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ConvexTest, createConvexTest, signIn } from "./test.helpers";

type Client = Awaited<ReturnType<typeof signIn>>["client"];

async function upload(t: ConvexTest) {
  return await t.run((ctx) => ctx.storage.store(new Blob(["file contents"])));
}

async function createAttachment(t: ConvexTest, client: Client, storageId?: Id<"_storage">) {
  return await client.mutation(api.attachments.create, {
    storageId: storageId ?? (await upload(t)),
    filename: "notes.txt",
    mimeType: "text/plain",
    fileSize: 13,
  });
}

describe("convex/attachments.ts ownership (audit item 2)", () => {
  it("won't attach someone else's upload to your message, or show it to you", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const alicesFile = await createAttachment(t, alice.client);
    const bobsConversation = await bob.client.mutation(api.conversations.create, {});

    await expect(
      bob.client.mutation(api.messages.sendUserMessage, {
        conversationId: bobsConversation,
        content: "look",
        attachmentIds: [alicesFile],
      }),
    ).rejects.toThrow("Access denied");

    const attachment = await t.run((ctx) => ctx.db.get(alicesFile));
    expect(attachment?.messageId).toBeUndefined();
    expect(attachment?.conversationId).toBeUndefined();
    await expect(bob.client.query(api.attachments.get, { id: alicesFile })).rejects.toThrow(
      "Access denied",
    );
  });

  it("links your own new upload to your message", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const file = await createAttachment(t, alice.client);
    const conversationId = await alice.client.mutation(api.conversations.create, {});

    const messageId = await alice.client.mutation(api.messages.sendUserMessage, {
      conversationId,
      content: "look",
      attachmentIds: [file],
    });

    expect(await t.run((ctx) => ctx.db.get(file))).toMatchObject({ messageId, conversationId });
  });

  it("won't move an attachment that's already on another message", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const file = await createAttachment(t, alice.client);
    const first = await alice.client.mutation(api.conversations.create, {});
    const second = await alice.client.mutation(api.conversations.create, {});
    const messageId = await alice.client.mutation(api.messages.sendUserMessage, {
      conversationId: first,
      content: "look",
      attachmentIds: [file],
    });

    await expect(
      alice.client.mutation(api.messages.sendUserMessage, {
        conversationId: second,
        content: "again",
        attachmentIds: [file],
      }),
    ).rejects.toThrow("already linked");
    expect(await t.run((ctx) => ctx.db.get(file))).toMatchObject({
      messageId,
      conversationId: first,
    });
  });

  it("won't record an upload that another attachment already claims", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const storageId = await upload(t);
    await createAttachment(t, alice.client, storageId);

    await expect(createAttachment(t, bob.client, storageId)).rejects.toThrow(
      "Upload is already attached",
    );
  });

  it("won't record a storage ID that doesn't exist", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const deleted = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["gone"]));
      await ctx.storage.delete(storageId);
      return storageId;
    });

    await expect(createAttachment(t, alice.client, deleted)).rejects.toThrow("Upload not found");
  });

  it("shares a group member's file for reading, but only its uploader can delete or move it", async () => {
    const t = createConvexTest();
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const group = await alice.client.mutation(api.groupChats.create, {
      title: "group",
      invitedUserIds: [bob.userId!],
    });
    const bobsFile = await createAttachment(t, bob.client);
    await bob.client.mutation(api.messages.sendUserMessage, {
      conversationId: group,
      content: "my file",
      attachmentIds: [bobsFile],
    });
    const alicesConversation = await alice.client.mutation(api.conversations.create, {});
    const alicesMessage = await alice.client.mutation(api.messages.sendUserMessage, {
      conversationId: alicesConversation,
      content: "mine now?",
    });

    expect((await alice.client.query(api.attachments.get, { id: bobsFile }))?._id).toBe(bobsFile);
    await expect(alice.client.mutation(api.attachments.remove, { id: bobsFile })).rejects.toThrow(
      "Access denied",
    );
    await expect(
      alice.client.mutation(api.attachments.linkToMessage, {
        attachmentId: bobsFile,
        messageId: alicesMessage,
        conversationId: alicesConversation,
      }),
    ).rejects.toThrow("Access denied");
    expect((await t.run((ctx) => ctx.db.get(bobsFile)))?.conversationId).toBe(group);
  });
});
