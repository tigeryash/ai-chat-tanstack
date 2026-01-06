import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

const messageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
  v.literal("tool")
);

const toolStateValidator = v.union(
  v.literal("input-streaming"),
  v.literal("input-available"),
  v.literal("output-available"),
  v.literal("output-error")
);

const messagePartValidator = v.union(
  v.object({
    type: v.literal("text"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  }),
  v.object({
    type: v.literal("tool-invocation"),
    toolCallId: v.string(),
    toolName: v.string(),
    state: toolStateValidator,
    input: v.any(),
    output: v.optional(v.any()),
    errorText: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("file"),
    mediaType: v.string(),
    filename: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v. id("_storage")),
  }),
  v.object({
    type: v.literal("reasoning"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  }),
  v.object({
    type: v.literal("source"),
    sourceType: v.union(v. literal("url"), v.literal("document")),
    id: v.optional(v.string()),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("step-start"),
    stepNumber: v.optional(v.number()),
  }),
  // For image generations
  v.object({
    type: v.literal("image"),
    url: v.string(),
    storageId: v.optional(v.id("_storage")),
    prompt: v.optional(v.string()),
    revisedPrompt: v.optional(v.string()),
  })
);

const artifactTypeValidator = v.union(
  v.literal("code"),
  v.literal("document"),
  v.literal("html"),
  v.literal("react_component"),
  v.literal("svg"),
  v.literal("mermaid"),
  v.literal("markdown"),
  v.literal("json"),
  v.literal("csv")
);

// ============================================================================
// SCHEMA
// ============================================================================

export default defineSchema({
  // ==========================================================================
  // USERS
  // ==========================================================================
  
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    
    preferences: v.optional(v.object({
      defaultModel: v. optional(v.string()),
      theme: v.optional(v. union(v.literal("light"), v.literal("dark"), v.literal("system"))),
    })),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  // ==========================================================================
  // CONVERSATIONS
  // ==========================================================================

  conversations: defineTable({
    userId: v.id("users"),
    
    title: v.optional(v.string()),
    
    model: v.optional(v.string()),
    modelProvider: v.optional(v. string()),
    systemPrompt: v. optional(v.string()),
    
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted")
    ),
    
    isPinned: v.optional(v.boolean()),
    
    // Sharing - public link sharing
    isShared: v. optional(v.boolean()),
    shareId: v.optional(v.string()),
    
    // Group chat support
    isGroupChat: v.optional(v. boolean()),
    
    messageCount: v.optional(v. number()),
    totalTokens: v.optional(v.number()),
    totalCostUsd:  v.optional(v.float64()),
    
    metadata: v.optional(v.any()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_user_status", ["userId", "status"])
    .index("by_share_id", ["shareId"])
    .index("by_user_pinned", ["userId", "isPinned"]),

  // ==========================================================================
  // CONVERSATION PARTICIPANTS (for group chats)
  // ==========================================================================

  conversationParticipants: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    
    role: v.union(
      v.literal("owner"),
      v.literal("member")
    ),
    
    // For tracking unread messages
    lastReadAt: v.optional(v.number()),
    
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  // ==========================================================================
  // MESSAGES
  // ==========================================================================

  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    
    // Branching support
    parentId: v.optional(v.id("messages")),
    branchIndex: v.optional(v.number()),
    isActiveBranch:  v.optional(v.boolean()),
    
    // For group chats - which user is being addressed
    mentionedUserId: v.optional(v. id("users")),
    
    role: messageRoleValidator,
    parts:  v.array(messagePartValidator),
    content: v.optional(v.string()),
    
    status: v.union(
      v.literal("pending"),
      v.literal("streaming"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    
    model: v.optional(v.string()),
    modelProvider: v.optional(v.string()),
    finishReason: v.optional(v.union(
      v.literal("stop"),
      v.literal("length"),
      v.literal("tool-calls"),
      v.literal("content-filter"),
      v.literal("error"),
      v.literal("cancelled")
    )),
    
    usage: v.optional(v.object({
      promptTokens: v.number(),
      completionTokens: v. number(),
      totalTokens:  v.number(),
      reasoningTokens: v.optional(v.number()),
      cachedTokens: v.optional(v. number()),
    })),
    costUsd: v.optional(v.float64()),
    latencyMs: v.optional(v.number()),
    
    hasToolCalls: v.optional(v.boolean()),
    toolCallIds: v.optional(v. array(v.string())),
    toolCallId: v.optional(v.string()),
    
    // Feedback for AI responses
    feedback: v.optional(v.object({
      rating: v.optional(v.union(v.literal("positive"), v.literal("negative"))),
      comment: v.optional(v.string()),
      feedbackAt: v.optional(v.number()),
    })),
    
    // Edit tracking
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
    originalContent: v.optional(v. string()),
    
    metadata:  v.optional(v.any()),
    deletedAt: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_parent", ["parentId"])
    .index("by_tool_call_id", ["toolCallId"])
    .index("by_user", ["userId"]),

  // ==========================================================================
  // ACTIVE CHAT SESSIONS (for multi-chat support)
  // ==========================================================================

  activeChatSessions: defineTable({
    userId: v.id("users"),
    
    // Array of currently open conversation IDs (max 8)
    conversationIds: v.array(v.id("conversations")),
    
    // Layout preferences
    layout: v.optional(v.union(
      v. literal("single"),
      v.literal("split-2"),
      v.literal("split-3"),
      v.literal("split-4"),
      v.literal("grid-4"),
      v.literal("grid-6"),
      v.literal("grid-8")
    )),
    
    // Which chat is currently focused
    focusedConversationId: v.optional(v.id("conversations")),
    
    // Position/order of chats
    chatPositions: v.optional(v. array(v.object({
      conversationId: v.id("conversations"),
      position: v.number(),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
    }))),
    
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ==========================================================================
  // ARTIFACTS
  // ==========================================================================

  artifacts: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    
    artifactType: artifactTypeValidator,
    title: v.string(),
    
    content: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    
    language: v.optional(v.string()),
    
    version: v.number(),
    parentArtifactId: v.optional(v.id("artifacts")),
    
    isPublished: v.optional(v.boolean()),
    shareId: v.optional(v. string()),
    
    metadata:  v.optional(v.any()),
    
    createdAt:  v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"])
    .index("by_share_id", ["shareId"]),

  // ==========================================================================
  // ATTACHMENTS
  // ==========================================================================

  attachments: defineTable({
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.id("messages")),
    userId: v.id("users"),
    
    storageId: v.id("_storage"),
    
    filename: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    
    metadata: v.optional(v.any()),
    
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"])
    .index("by_user", ["userId"]),

  // ==========================================================================
  // USAGE TRACKING
  // ==========================================================================

  usageEvents: defineTable({
    userId:  v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v. id("messages")),
    
    model: v.string(),
    modelProvider: v. string(),
    
    promptTokens: v.number(),
    completionTokens: v. number(),
    totalTokens: v.number(),
    reasoningTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    
    costUsd: v.float64(),
    latencyMs: v.optional(v.number()),
    
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "createdAt"])
    .index("by_conversation", ["conversationId"]),
});