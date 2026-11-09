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

	// ==========================================================================
	// CSP VIOLATION REPORTS (quality audit G1): aggregate counts, written only by convex/cspReports.ts
	// ==========================================================================

	cspReports: defineTable({
		disposition: v.union(v.literal("enforce"), v.literal("report")),
		directive: v.string(),
		/** An origin, or a keyword such as `inline` or `eval`. Never a full URL. */
		blockedOrigin: v.string(),
		/** A route pattern (`/settings`, `/[chatId]`), never a real path, query or fragment. */
		page: v.string(),
		count: v.number(),
		firstSeen: v.number(),
		lastSeen: v.number(),
	})
		.index("by_key", ["disposition", "directive", "blockedOrigin", "page"])
		.index("by_lastSeen", ["lastSeen"]),
});
