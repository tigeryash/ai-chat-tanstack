import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dropOAuthTokens } from "./oauthTokens";

// Made-up values throughout. Nothing here reaches GitHub: fetch is stubbed.
const BASE_URL = "http://localhost:3000";
const EMAIL = "someone@example.test";
const PASSWORD = "correct-horse-battery";
const GITHUB_TOKENS = {
	access_token: "gho_fake_access_token",
	refresh_token: "ghr_fake_refresh_token",
	id_token: "fake.id.token",
	token_type: "bearer",
	scope: "read:user,user:email",
	expires_in: 28800,
};
const TOKEN_FIELDS = [
	"accessToken",
	"refreshToken",
	"idToken",
	"accessTokenExpiresAt",
	"refreshTokenExpiresAt",
] as const;

type Row = Record<string, unknown>;

// A real Better Auth instance with the account settings of convex/auth.ts, on an in-memory database.
function createTestAuth() {
	const db: Record<string, Row[]> = {
		user: [],
		session: [],
		account: [],
		verification: [],
	};
	const auth = betterAuth({
		baseURL: BASE_URL,
		secret: "test-secret-that-is-at-least-32-characters-long",
		logger: { disabled: true },
		database: memoryAdapter(db),
		databaseHooks: { account: dropOAuthTokens },
		emailAndPassword: { enabled: true, requireEmailVerification: true },
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ["email-password", "github", "discord", "google"],
				allowDifferentEmails: false,
				allowUnlinkingAll: true,
				updateUserInfoOnLink: true,
			},
		},
		socialProviders: {
			github: {
				clientId: "fake-client-id",
				clientSecret: "fake-client-secret",
			},
		},
	});
	return { auth, db };
}

type TestAuth = ReturnType<typeof createTestAuth>["auth"];

// GitHub's token, profile, and email endpoints, answering for one fake GitHub user.
function stubGitHub() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request) => {
			const url = input instanceof Request ? input.url : String(input);
			const json = (body: unknown) =>
				new Response(JSON.stringify(body), {
					headers: { "content-type": "application/json" },
				});
			if (url.startsWith("https://github.com/login/oauth/access_token"))
				return json(GITHUB_TOKENS);
			if (url === "https://api.github.com/user") {
				return json({
					id: 4242,
					login: "someone",
					name: "Someone",
					email: EMAIL,
					avatar_url: null,
				});
			}
			if (url === "https://api.github.com/user/emails") {
				return json([{ email: EMAIL, primary: true, verified: true }]);
			}
			throw new Error(`Unexpected request in test: ${url}`);
		}),
	);
}

function cookiesFrom(response: Response, existing = "") {
	const fresh = response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0]);
	return [existing, ...fresh].filter(Boolean).join("; ");
}

// Starts a GitHub sign-in (or, with `link`, a link from a signed-in session) and completes the
// OAuth callback the way a browser returning from GitHub would.
async function completeGitHubFlow(
	auth: TestAuth,
	{ cookie = "", link = false } = {},
) {
	const start = await auth.handler(
		new Request(
			`${BASE_URL}/api/auth/${link ? "link-social" : "sign-in/social"}`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: BASE_URL,
					cookie,
				},
				body: JSON.stringify({ provider: "github", callbackURL: "/new" }),
			},
		),
	);
	expect(start.status).toBe(200);
	const { url } = (await start.json()) as { url: string };
	const state = new URL(url).searchParams.get("state");
	const flowCookie = cookiesFrom(start, cookie);

	const callback = await auth.handler(
		new Request(
			`${BASE_URL}/api/auth/callback/github?code=fake-code&state=${state}`,
			{
				headers: { cookie: flowCookie },
			},
		),
	);
	return { callback, cookie: cookiesFrom(callback, flowCookie) };
}

async function signedInEmail(auth: TestAuth, cookie: string) {
	const session = await auth.api.getSession({
		headers: new Headers({ cookie }),
	});
	return session?.user.email;
}

function expectNoTokens(account: Row | undefined) {
	expect(account).toBeDefined();
	for (const field of TOKEN_FIELDS) {
		expect(account?.[field] ?? null, field).toBeNull();
	}
}

describe("convex/lib/oauthTokens.ts dropOAuthTokens", () => {
	beforeEach(() => {
		stubGitHub();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("signs a new user up with GitHub without storing GitHub's tokens", async () => {
		const { auth, db } = createTestAuth();

		const { callback, cookie } = await completeGitHubFlow(auth);

		expect(callback.status).toBe(302);
		expect(callback.headers.get("location")).toBe("/new");
		expect(await signedInEmail(auth, cookie)).toBe(EMAIL);
		expect(db.account).toHaveLength(1);
		expect(db.account[0]).toMatchObject({
			providerId: "github",
			accountId: "4242",
		});
		expectNoTokens(db.account[0]);
	});

	it("keeps the tokens empty when the user signs in with GitHub again", async () => {
		const { auth, db } = createTestAuth();
		await completeGitHubFlow(auth);

		const { callback, cookie } = await completeGitHubFlow(auth);

		expect(callback.status).toBe(302);
		expect(await signedInEmail(auth, cookie)).toBe(EMAIL);
		expect(db.account).toHaveLength(1);
		expectNoTokens(db.account[0]);
	});

	it("links GitHub to an existing email account on sign-in, without tokens", async () => {
		const { auth, db } = createTestAuth();
		await auth.api.signUpEmail({
			body: { email: EMAIL, password: PASSWORD, name: "Someone" },
		});
		db.user[0].emailVerified = true;

		const { callback, cookie } = await completeGitHubFlow(auth);

		expect(callback.status).toBe(302);
		expect(await signedInEmail(auth, cookie)).toBe(EMAIL);
		expect(db.user).toHaveLength(1);
		const github = db.account.find(
			(account) => account.providerId === "github",
		);
		expect(github?.userId).toBe(db.user[0].id);
		expectNoTokens(github);
		// The password account is untouched.
		expect(
			db.account.find((account) => account.providerId === "credential")
				?.password,
		).toEqual(expect.any(String));
	});

	it("links GitHub from a signed-in session, without tokens", async () => {
		const { auth, db } = createTestAuth();
		await auth.api.signUpEmail({
			body: { email: EMAIL, password: PASSWORD, name: "Someone" },
		});
		db.user[0].emailVerified = true;
		const signIn = await auth.handler(
			new Request(`${BASE_URL}/api/auth/sign-in/email`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: BASE_URL },
				body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
			}),
		);
		expect(signIn.status).toBe(200);

		const { callback } = await completeGitHubFlow(auth, {
			cookie: cookiesFrom(signIn),
			link: true,
		});

		expect(callback.status).toBe(302);
		const github = db.account.find(
			(account) => account.providerId === "github",
		);
		expect(github?.userId).toBe(db.user[0].id);
		expectNoTokens(github);
	});
});
