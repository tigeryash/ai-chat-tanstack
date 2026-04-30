/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activeSessions from "../activeSessions.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as branching from "../branching.js";
import type * as conversations from "../conversations.js";
import type * as email from "../email.js";
import type * as groupChats from "../groupChats.js";
import type * as http from "../http.js";
import type * as lib_utils from "../lib/utils.js";
import type * as messagePins from "../messagePins.js";
import type * as messages from "../messages.js";
import type * as sharing from "../sharing.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activeSessions: typeof activeSessions;
  attachments: typeof attachments;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  branching: typeof branching;
  conversations: typeof conversations;
  email: typeof email;
  groupChats: typeof groupChats;
  http: typeof http;
  "lib/utils": typeof lib_utils;
  messagePins: typeof messagePins;
  messages: typeof messages;
  sharing: typeof sharing;
  usage: typeof usage;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
