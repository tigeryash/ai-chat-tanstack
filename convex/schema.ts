import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
	catalogSourceValidator,
	modelFields,
} from "./lib/modelCatalog/validators";

export default defineSchema({
	// ==========================================================================
	// USERS
	// ==========================================================================

	users: defineTable({
		authUserId: v.optional(v.string()),
		tokenIdentifier: v.optional(v.string()),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),

		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_auth_user", ["authUserId"])
		.index("by_token", ["tokenIdentifier"])
		.index("by_email", ["email"]),

	// ==========================================================================
	// MODEL CATALOG (roadmap 2.1): public data synced daily by convex/modelCatalogSync.ts
	// ==========================================================================

	models: defineTable(modelFields)
		.index("by_gateway_id", ["gatewayId"])
		.index("by_status", ["status"]),

	modelCatalogSources: defineTable({
		source: catalogSourceValidator,
		lastAttemptAt: v.number(),
		/** Last run where this source answered. Its data in `models` is as of this time. */
		lastSyncedAt: v.optional(v.number()),
		/** Set while the latest attempt failed. */
		lastError: v.optional(v.string()),
		/** Set when the latest attempt answered only partly. */
		lastWarning: v.optional(v.string()),
		itemCount: v.optional(v.number()),
	}).index("by_source", ["source"]),
});
