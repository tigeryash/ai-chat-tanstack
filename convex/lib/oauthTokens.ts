import type { BetterAuthOptions } from "better-auth";

type AccountHooks = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["account"]>;

/**
 * The Better Auth `account` fields that hold OAuth provider tokens, blanked. Google, GitHub, and
 * Discord are only used to sign in, never to call their APIs, so we don't keep their tokens
 * (docs/data-inventory.md, decided 2026-10-20).
 */
export const CLEARED_OAUTH_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
} as const;

/**
 * Better Auth `databaseHooks.account`. Better Auth writes provider tokens when an account is created,
 * linked, or signed in to again; these hooks blank them before every one of those writes.
 */
export const dropOAuthTokens: AccountHooks = {
  create: {
    before: async (account) => ({ data: { ...account, ...CLEARED_OAUTH_TOKENS } }),
  },
  update: {
    before: async (account) => ({ data: { ...account, ...CLEARED_OAUTH_TOKENS } }),
  },
};
