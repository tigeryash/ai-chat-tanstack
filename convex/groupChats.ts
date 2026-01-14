import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentUser(ctx: any) {
  const identity = await ctx. auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();

  if (!user) throw new Error("User not found");
  return user;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List group chats the user is part of
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return [];

    // Get conversations user owns
    const ownedConversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .filter((q) => q.eq(q.field("isGroupChat"), true))
      .collect();

    // Get conversations user is a participant in
    const participations = await ctx.db
      . query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();

    const participantConversationIds = participations.map((p) => p.conversationId);
    const participantConversations = await Promise.all(
      participantConversationIds.map((id) => ctx.db.get(id))
    );

    // Combine and deduplicate
    const allGroupChats = [
      ...ownedConversations,
      ...participantConversations.filter(
        (c) => c && c.status === "active" && ! ownedConversations.find((o) => o._id === c._id)
      ),
    ];

    return allGroupChats. filter(Boolean);
  },
});

/**
 * Get participants of a group chat
 */
export const getParticipants = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db. get(args.conversationId);
    if (!conversation || !conversation. isGroupChat) return [];

    const participants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();

    // Get user details for each participant
    const participantsWithDetails = await Promise.all(
      participants.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          ...p,
          user: user
            ? {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
        };
      })
    );

    // Add owner
    const owner = await ctx.db.get(conversation.userId);
    const ownerParticipant = {
      conversationId: args.conversationId,
      userId: conversation.userId,
      role: "owner" as const,
      joinedAt: conversation.createdAt,
      user: owner
        ? {
            id: owner._id,
            name: owner.name,
            email: owner.email,
            avatarUrl: owner.avatarUrl,
          }
        :  null,
    };

    return [ownerParticipant, ... participantsWithDetails];
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new group chat
 */
export const create = mutation({
  args: {
    title: v.string(),
    model: v.optional(v.string()),
    modelProvider: v. optional(v.string()),
    systemPrompt: v.optional(v.string()),
    invitedUserIds: v.optional(v. array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const now = Date.now();

    // Create conversation
    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      title: args. title,
      model: args. model,
      modelProvider: args.modelProvider,
      systemPrompt: args.systemPrompt,
      status: "active",
      isGroupChat: true,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Add invited users as participants
    if (args.invitedUserIds) {
      for (const invitedUserId of args.invitedUserIds) {
        await ctx.db. insert("conversationParticipants", {
          conversationId,
          userId: invitedUserId,
          role: "member",
          joinedAt: now,
        });
      }
    }

    return conversationId;
  },
});

/**
 * Invite a user to a group chat
 */
export const inviteUser = mutation({
  args: {
    conversationId:  v.id("conversations"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.isGroupChat) throw new Error("Not a group chat");

    // Check if user is owner or admin
    const isOwner = conversation.userId === user._id;
    const participation = await ctx.db
      . query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args. conversationId)
      )
      .first();

    const isAdmin = participation?.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new Error("Only owners and admins can invite users");
    }

    // Find user by email
    const invitedUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!invitedUser) {
      throw new Error("User not found with that email");
    }

    // Check if already a participant
    const existingParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", invitedUser._id).eq("conversationId", args.conversationId)
      )
      .first();

    if (existingParticipation && ! existingParticipation.leftAt) {
      throw new Error("User is already a participant");
    }

    // Re-add if they left before, otherwise create new
    if (existingParticipation) {
      await ctx.db. patch(existingParticipation._id, {
        leftAt: undefined,
        joinedAt: Date.now(),
      });
    } else {
      await ctx. db.insert("conversationParticipants", {
        conversationId: args.conversationId,
        userId: invitedUser._id,
        role: "member",
        joinedAt:  Date.now(),
      });
    }

    return invitedUser._id;
  },
});

/**
 * Remove a user from a group chat
 */
export const removeUser = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db. get(args.conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.isGroupChat) throw new Error("Not a group chat");

    // Check permissions
    const isOwner = conversation.userId === user._id;
    const isSelf = args.userId === user._id;

    if (!isOwner && ! isSelf) {
      throw new Error("Only owners can remove other users");
    }

    // Can't remove owner
    if (args.userId === conversation.userId) {
      throw new Error("Cannot remove the owner");
    }

    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    if (!participation) {
      throw new Error("User is not a participant");
    }

    await ctx.db.patch(participation._id, {
      leftAt:  Date.now(),
    });
  },
});

/**
 * Leave a group chat
 */
export const leave = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args. conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.isGroupChat) throw new Error("Not a group chat");

    // Owner can't leave - they must delete or transfer ownership
    if (conversation.userId === user._id) {
      throw new Error("Owner cannot leave.  Transfer ownership or delete the chat.");
    }

    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .first();

    if (!participation) {
      throw new Error("You are not a participant");
    }

    await ctx.db.patch(participation._id, {
      leftAt:  Date.now(),
    });
  },
});

/**
 * Update participant role
 */
export const updateRole = mutation({
  args:  {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args. conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (conversation.userId !== user._id) {
      throw new Error("Only owner can change roles");
    }

    const participation = await ctx.db
      . query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    if (!participation) {
      throw new Error("User is not a participant");
    }

    await ctx.db.patch(participation._id, {
      role: args.role,
    });
  },
});

/**
 * Send message with @mention in group chat
 */
export const sendMentionMessage = mutation({
  args: {
    conversationId:  v.id("conversations"),
    content: v.string(),
    mentionedUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const conversation = await ctx.db.get(args. conversationId);

    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.isGroupChat) throw new Error("Not a group chat");

    // Verify user has access
    const isOwner = conversation.userId === user._id;
    const participation = await ctx.db
      . query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .first();

    if (!isOwner && (! participation || participation.leftAt)) {
      throw new Error("Access denied");
    }

    const now = Date.now();

    // Get the last message to set as parent
    const lastMessage = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .first();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      userId: user._id,
      role: "user",
      parts: [{ type: "text", text: args. content }],
      content: args.content,
      status: "completed",
      mentionedUserId: args.mentionedUserId,
      parentId: lastMessage?._id,
      isActiveBranch: true,
      createdAt: now,
      updatedAt: now,
    });

    // Update conversation
    await ctx.db.patch(args.conversationId, {
      messageCount: (conversation.messageCount ??  0) + 1,
      lastMessageAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

/**
 * Mark messages as read (update lastReadAt)
 */
export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const participation = await ctx.db
      . query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .first();

    if (participation) {
      await ctx.db. patch(participation._id, {
        lastReadAt: Date.now(),
      });
    }
  },
});