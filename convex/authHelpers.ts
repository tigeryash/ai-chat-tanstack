import type { UserIdentity } from "convex/server";
import { authComponent } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AppUser = Doc<"users">;
type Conversation = Doc<"conversations">;
type Message = Doc<"messages">;
type Attachment = Doc<"attachments">;
type AuthUser = NonNullable<Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>>;

function getAuthUserAvatar(authUser: AuthUser, identity: UserIdentity): string | undefined {
  return authUser.image ?? identity.pictureUrl ?? undefined;
}

function buildUserProfilePatch(user: AppUser, authUser: AuthUser, identity: UserIdentity) {
  const name = authUser.name ?? identity.name;
  const email = authUser.email ?? identity.email;
  const avatarUrl = getAuthUserAvatar(authUser, identity);

  const patch: Partial<AppUser> = {};

  if (user.authUserId !== authUser._id) {
    patch.authUserId = authUser._id;
  }

  if (user.tokenIdentifier !== identity.tokenIdentifier) {
    patch.tokenIdentifier = identity.tokenIdentifier;
  }

  if (name !== undefined && user.name !== name) {
    patch.name = name;
  }

  if (email !== undefined && user.email !== email) {
    patch.email = email;
  }

  if (avatarUrl !== undefined && user.avatarUrl !== avatarUrl) {
    patch.avatarUrl = avatarUrl;
  }

  return patch;
}

async function findUserByLegacyFields(
  ctx: QueryCtx,
  authUser: AuthUser,
  identity: UserIdentity,
): Promise<AppUser | null> {
  if (authUser.email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", authUser.email))
      .first();

    if (byEmail) {
      return byEmail;
    }
  }

  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
}

async function getAuthIdentity(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) {
    return null;
  }

  return { identity, authUser };
}

async function findAppUser(ctx: QueryCtx, authUser: AuthUser, identity: UserIdentity) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", authUser._id))
    .first();

  return user ?? (await findUserByLegacyFields(ctx, authUser, identity));
}

/**
 * The signed-in user's `users` row, or null. Read-only, so it's safe in queries. The row is created
 * by `users.getOrCreate` (see `upsertCurrentUser`), which the sidebar calls once someone is signed in.
 */
export async function getCurrentUserOrNull(ctx: QueryCtx): Promise<AppUser | null> {
  const auth = await getAuthIdentity(ctx);
  if (!auth) {
    return null;
  }

  return await findAppUser(ctx, auth.authUser, auth.identity);
}

export async function getCurrentUser(ctx: QueryCtx): Promise<AppUser> {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) {
    throw new Error("Unauthenticated");
  }
  return user;
}

/**
 * Creates the signed-in user's `users` row, or refreshes its profile fields from Better Auth.
 * Mutations only; queries use `getCurrentUserOrNull`.
 */
export async function upsertCurrentUser(ctx: MutationCtx): Promise<AppUser> {
  const auth = await getAuthIdentity(ctx);
  if (!auth) {
    throw new Error("Unauthenticated");
  }

  const { identity, authUser } = auth;
  const user = await findAppUser(ctx, authUser, identity);
  const now = Date.now();

  if (!user) {
    const userId = await ctx.db.insert("users", {
      authUserId: authUser._id,
      tokenIdentifier: identity.tokenIdentifier,
      name: authUser.name ?? identity.name,
      email: authUser.email ?? identity.email,
      avatarUrl: getAuthUserAvatar(authUser, identity),
      createdAt: now,
      updatedAt: now,
    });

    const created = await ctx.db.get(userId);
    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  }

  const patch = buildUserProfilePatch(user, authUser, identity);
  if (Object.keys(patch).length === 0) {
    return user;
  }

  await ctx.db.patch(user._id, { ...patch, updatedAt: now });
  return { ...user, ...patch, updatedAt: now };
}

export async function requireConversationAccess(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Conversation> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.userId === userId) {
    return conversation;
  }

  if (conversation.isGroupChat) {
    const participant = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", conversationId),
      )
      .first();

    if (participant && !participant.leftAt) {
      return conversation;
    }
  }

  throw new Error("Access denied");
}

export async function getConversationIfAccessible(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Conversation | null> {
  try {
    return await requireConversationAccess(ctx, conversationId, userId);
  } catch {
    return null;
  }
}

export async function requireMessageAccess(
  ctx: QueryCtx,
  messageId: Id<"messages">,
  userId: Id<"users">,
): Promise<Message> {
  const message = await ctx.db.get(messageId);
  if (!message) {
    throw new Error("Message not found");
  }

  await requireConversationAccess(ctx, message.conversationId, userId);
  return message;
}

/**
 * A message the caller wrote (or, for an assistant message, started), in a conversation they can
 * still access. Use for anything that changes a message.
 */
export async function requireOwnMessage(
  ctx: QueryCtx,
  messageId: Id<"messages">,
  userId: Id<"users">,
): Promise<Message> {
  const message = await requireMessageAccess(ctx, messageId, userId);
  if (message.userId !== userId) {
    throw new Error("Access denied");
  }
  return message;
}

/** A parent message must sit in the same conversation as the reply being written to it. */
export async function requireParentInConversation(
  ctx: QueryCtx,
  parentId: Id<"messages">,
  conversationId: Id<"conversations">,
): Promise<Message> {
  const parent = await ctx.db.get(parentId);
  if (!parent || parent.deletedAt || parent.conversationId !== conversationId) {
    throw new Error("Parent message not found");
  }
  return parent;
}

export async function requireAttachmentAccess(
  ctx: QueryCtx,
  attachmentId: Id<"attachments">,
  userId: Id<"users">,
): Promise<Attachment> {
  const attachment = await ctx.db.get(attachmentId);
  if (!attachment) {
    throw new Error("Attachment not found");
  }

  if (attachment.userId === userId) {
    return attachment;
  }

  if (attachment.conversationId) {
    await requireConversationAccess(ctx, attachment.conversationId, userId);
    return attachment;
  }

  throw new Error("Access denied");
}

/**
 * An attachment the caller uploaded. Reading is shared with conversation members
 * (`requireAttachmentAccess`), but only the uploader can link, move, or delete it.
 */
export async function requireOwnAttachment(
  ctx: QueryCtx,
  attachmentId: Id<"attachments">,
  userId: Id<"users">,
): Promise<Attachment> {
  const attachment = await ctx.db.get(attachmentId);
  if (!attachment) {
    throw new Error("Attachment not found");
  }
  if (attachment.userId !== userId) {
    throw new Error("Access denied");
  }
  return attachment;
}

export async function requireMultiChatConversation(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
): Promise<Conversation> {
  const conversation = await requireConversationAccess(ctx, conversationId, userId);

  if (conversation.isGroupChat) {
    throw new Error("Group chats cannot be added to multi-chat sessions");
  }

  if (conversation.status !== "active") {
    throw new Error("Only active conversations can be added to multi-chat sessions");
  }

  return conversation;
}
