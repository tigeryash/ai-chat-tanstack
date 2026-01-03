// convex/schema.ts
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
  // Text content
  v.object({
    type: v.literal("text"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  }),
  // Tool invocation
  v.object({
    type: v.literal("tool-invocation"),
    toolCallId: v.string(),
    toolName: v.string(),
    state: toolStateValidator,
    input: v.any(),
    output: v.optional(v.any()),
    errorText: v.optional(v.string()),
  }),
  // File/image content
  v.object({
    type: v.literal("file"),
    mediaType: v.string(),
    filename: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  }),
  // Reasoning (for o1 models)
  v.object({
    type: v.literal("reasoning"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  })
);

const artifactTypeValidator = v.union(
  v.literal("code"),
  v.literal("document"),
  v.literal("html"),
  v.literal("react_component"),
  v.literal("svg"),
  v.literal("mermaid")
);

// ============================================================================
// SCHEMA
// ============================================================================

export default defineSchema({
  // ==========================================================================
  // USERS
  // ==========================================================================
  
  users: defineTable({
    tokenIdentifier: v.string(), // Auth provider ID (Clerk, etc.)
    
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    
    preferences: v.optional(v.object({
      defaultModel: v.optional(v.string()),
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
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
    
    // AI configuration for this conversation
    model: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted")
    ),
    
    isPinned: v.optional(v.boolean()),
    
    // Sharing
    isShared: v.optional(v.boolean()),
    shareId: v.optional(v.string()),
    
    // Stats
    messageCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    totalCostUsd: v.optional(v.float64()),
    
    metadata: v.optional(v.any()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_user_status", ["userId", "status"])
    .index("by_share_id", ["shareId"]),

  // ==========================================================================
  // MESSAGES
  // ==========================================================================

  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    
    // Branching support
    parentId: v.optional(v.id("messages")),
    branchIndex: v.optional(v.number()),
    isActiveBranch: v.optional(v.boolean()),
    
    role: messageRoleValidator,
    
    // AI SDK v6 parts-based structure
    parts: v.array(messagePartValidator),
    
    // Legacy text field
    content: v.optional(v.string()),
    
    status: v.union(
      v.literal("pending"),
      v.literal("streaming"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    
    // AI metadata
    model: v.optional(v.string()),
    finishReason: v.optional(v.union(
      v.literal("stop"),
      v.literal("length"),
      v.literal("tool-calls"),
      v.literal("content-filter"),
      v.literal("error")
    )),
    
    // Token usage (provider-specific fields are optional)
    usage: v.optional(v.object({
      promptTokens: v.number(),
      completionTokens: v.number(),
      totalTokens: v.number(),
      reasoningTokens: v.optional(v.number()), // o1 models only
      cachedTokens: v.optional(v.number()),    // Anthropic, etc.
    })),
    costUsd: v.optional(v.float64()),
    
    latencyMs: v.optional(v.number()),
    
    // Tool calls summary
    hasToolCalls: v.optional(v.boolean()),
    toolCallIds: v.optional(v.array(v.string())),
    
    // For tool role messages
    toolCallId: v.optional(v.string()),
    
    metadata: v.optional(v.any()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_parent", ["parentId"])
    .index("by_tool_call_id", ["toolCallId"]),

  // ==========================================================================
  // ARTIFACTS (Optional - Claude-style generated content)
  // ==========================================================================

  artifacts: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    
    artifactType: artifactTypeValidator,
    title: v.string(),
    
    // Content storage
    content: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")), // For large content
    
    language: v.optional(v.string()), // For code artifacts
    
    // Versioning
    version: v.number(),
    parentArtifactId: v.optional(v.id("artifacts")),
    
    // Sharing
    isPublished: v.optional(v.boolean()),
    shareId: v.optional(v.string()),
    
    metadata: v.optional(v.any()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"])
    .index("by_share_id", ["shareId"]),

  // ==========================================================================
  // ATTACHMENTS (User uploads)
  // ==========================================================================

  attachments: defineTable({
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.id("messages")),
    userId: v.id("users"),
    
    storageId: v.id("_storage"),
    
    filename: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    
    // For images
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
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.optional(v.id("messages")),
    
    model: v.string(),
    modelProvider: v.string(),
    
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    
    // Provider-specific token types
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