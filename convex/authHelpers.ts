import { authComponent } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";

type Ctx = any;

type AppUser = Doc<"users">;
type Conversation = Doc<"conversations">;
type Message = Doc<"messages">;
type Attachment = Doc<"attachments">;

function getAuthUserId(authUser: any): string {
  return authUser._id ?? authUser.id;
}

function getAuthUserAvatar(authUser: any, identity: any): string | undefined {
  return authUser.image ?? authUser.avatarUrl ?? identity?.pictureUrl;
}

function buildUserProfilePatch(user: AppUser | null, authUser: any, identity: any) {
  const authUserId = getAuthUserId(authUser);
  const name = authUser.name ?? identity?.name;
  const email = authUser.email ?? identity?.email;
  const avatarUrl = getAuthUserAvatar(authUser, identity);

  const patch: Partial<AppUser> = {};

  if (!user?.authUserId || user.authUserId !== authUserId) {
    patch.authUserId = authUserId;
  }

  if (identity?.tokenIdentifier && user?.tokenIdentifier !== identity.tokenIdentifier) {
    patch.tokenIdentifier = identity.tokenIdentifier;
  }

  if (name !== undefined && user?.name !== name) {
    patch.name = name;
  }

  if (email !== undefined && user?.email !== email) {
    patch.email = email;
  }

  if (avatarUrl !== undefined && user?.avatarUrl !== avatarUrl) {
    patch.avatarUrl = avatarUrl;
  }

  return patch;
}

async function findUserByLegacyFields(
  ctx: Ctx,
  authUser: any,
  identity: any,
): Promise<AppUser | null> {
  if (authUser.email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", authUser.email))
      .first();

    if (byEmail) {
      return byEmail;
    }
  }

  if (identity?.tokenIdentifier) {
    const byToken = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .first();

    if (byToken) {
      return byToken;
    }
  }

  return null;
}

export async function getCurrentUserOrNull(ctx: Ctx): Promise<AppUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  let authUser: any;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    return null;
  }

  const authUserId = getAuthUserId(authUser);
  let user = await ctx.db
    .query("users")
    .withIndex("by_auth_user", (q: any) => q.eq("authUserId", authUserId))
    .first();

  if (!user) {
    user = await findUserByLegacyFields(ctx, authUser, identity);
  }

  const patch = buildUserProfilePatch(user, authUser, identity);

  if (!user) {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      authUserId,
      tokenIdentifier: identity.tokenIdentifier,
      name: authUser.name ?? identity.name,
      email: authUser.email ?? identity.email,
      avatarUrl: getAuthUserAvatar(authUser, identity),
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(userId);
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(user._id, {
      ...patch,
      updatedAt: Date.now(),
    });

    return {
      ...user,
      ...patch,
      updatedAt: Date.now(),
    };
  }

  return user;
}

export async function getCurrentUser(ctx: Ctx): Promise<AppUser> {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) {
    throw new Error("Unauthenticated");
  }
  return user;
}

export async function requireConversationAccess(
  ctx: Ctx,
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
      .withIndex("by_user_conversation", (q: any) =>
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
  ctx: Ctx,
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
  ctx: Ctx,
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

export async function requireAttachmentAccess(
  ctx: Ctx,
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

export async function requireMultiChatConversation(
  ctx: Ctx,
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