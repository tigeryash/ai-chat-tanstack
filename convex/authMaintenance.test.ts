import { afterEach, describe, expect, it, vi } from "vitest";
import { components, internal } from "./_generated/api";
import { createConvexTest } from "./test.helpers";

// More than one page (100 rows), so the scheduled continuation runs too.
const GITHUB_ACCOUNTS = 150;

describe("convex/authMaintenance.ts clearStoredOAuthTokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blanks stored OAuth tokens on every page and leaves password accounts alone", async () => {
    vi.useFakeTimers();
    const t = createConvexTest();
    const now = Date.now();
    await t.run(async (ctx) => {
      const create = (data: Record<string, unknown>) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "account",
            data: {
              accountId: "",
              providerId: "",
              userId: "user",
              createdAt: now,
              updatedAt: now,
              ...data,
            },
          },
        });
      for (let i = 0; i < GITHUB_ACCOUNTS; i++) {
        await create({
          accountId: `github-${i}`,
          providerId: "github",
          accessToken: "gho_fake_access_token",
          refreshToken: "ghr_fake_refresh_token",
          idToken: "fake.id.token",
          accessTokenExpiresAt: now + 1000,
          refreshTokenExpiresAt: now + 2000,
          scope: "read:user",
        });
      }
      await create({ accountId: "user", providerId: "credential", password: "fake-hash" });
    });

    await t.mutation(internal.authMaintenance.clearStoredOAuthTokens, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const accounts = await t.run(async (ctx) => {
      const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "account",
        paginationOpts: { cursor: null, numItems: GITHUB_ACCOUNTS + 10 },
      });
      return result.page as Record<string, unknown>[];
    });
    const github = accounts.filter((account) => account.providerId === "github");
    expect(github).toHaveLength(GITHUB_ACCOUNTS);
    for (const account of github) {
      expect(account).toMatchObject({
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: "read:user",
      });
    }
    const credential = accounts.find((account) => account.providerId === "credential");
    expect(credential).toMatchObject({ password: "fake-hash" });
    expect(credential).not.toHaveProperty("accessToken");
  });
});
