/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as authMaintenance from "../authMaintenance.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emailGuard from "../emailGuard.js";
import type * as http from "../http.js";
import type * as lib_hideAccountExistence from "../lib/hideAccountExistence.js";
import type * as lib_modelCatalog_diff from "../lib/modelCatalog/diff.js";
import type * as lib_modelCatalog_match from "../lib/modelCatalog/match.js";
import type * as lib_modelCatalog_merge from "../lib/modelCatalog/merge.js";
import type * as lib_modelCatalog_normalize from "../lib/modelCatalog/normalize.js";
import type * as lib_modelCatalog_sources_artificialAnalysis from "../lib/modelCatalog/sources/artificialAnalysis.js";
import type * as lib_modelCatalog_sources_gateway from "../lib/modelCatalog/sources/gateway.js";
import type * as lib_modelCatalog_sources_http from "../lib/modelCatalog/sources/http.js";
import type * as lib_modelCatalog_sources_modelsDev from "../lib/modelCatalog/sources/modelsDev.js";
import type * as lib_modelCatalog_sources_openRouter from "../lib/modelCatalog/sources/openRouter.js";
import type * as lib_modelCatalog_sources_parse from "../lib/modelCatalog/sources/parse.js";
import type * as lib_modelCatalog_sync from "../lib/modelCatalog/sync.js";
import type * as lib_modelCatalog_validators from "../lib/modelCatalog/validators.js";
import type * as lib_modelCatalog_view from "../lib/modelCatalog/view.js";
import type * as lib_oauthTokens from "../lib/oauthTokens.js";
import type * as lib_passwordPolicy from "../lib/passwordPolicy.js";
import type * as lib_zod from "../lib/zod.js";
import type * as modelCatalogSync from "../modelCatalogSync.js";
import type * as models from "../models.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  authMaintenance: typeof authMaintenance;
  crons: typeof crons;
  email: typeof email;
  emailGuard: typeof emailGuard;
  http: typeof http;
  "lib/hideAccountExistence": typeof lib_hideAccountExistence;
  "lib/modelCatalog/diff": typeof lib_modelCatalog_diff;
  "lib/modelCatalog/match": typeof lib_modelCatalog_match;
  "lib/modelCatalog/merge": typeof lib_modelCatalog_merge;
  "lib/modelCatalog/normalize": typeof lib_modelCatalog_normalize;
  "lib/modelCatalog/sources/artificialAnalysis": typeof lib_modelCatalog_sources_artificialAnalysis;
  "lib/modelCatalog/sources/gateway": typeof lib_modelCatalog_sources_gateway;
  "lib/modelCatalog/sources/http": typeof lib_modelCatalog_sources_http;
  "lib/modelCatalog/sources/modelsDev": typeof lib_modelCatalog_sources_modelsDev;
  "lib/modelCatalog/sources/openRouter": typeof lib_modelCatalog_sources_openRouter;
  "lib/modelCatalog/sources/parse": typeof lib_modelCatalog_sources_parse;
  "lib/modelCatalog/sync": typeof lib_modelCatalog_sync;
  "lib/modelCatalog/validators": typeof lib_modelCatalog_validators;
  "lib/modelCatalog/view": typeof lib_modelCatalog_view;
  "lib/oauthTokens": typeof lib_oauthTokens;
  "lib/passwordPolicy": typeof lib_passwordPolicy;
  "lib/zod": typeof lib_zod;
  modelCatalogSync: typeof modelCatalogSync;
  models: typeof models;
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
