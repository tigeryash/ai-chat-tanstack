import type { BrowserContext } from "@playwright/test";

// Test-only accounts. The e2e Convex stub (convex-stub.ts) answers Better Auth's `get-session` with a
// signed-in user while this cookie names one, and its sign-out clears the cookie. Convex itself stays
// signed out, so this covers what the browser decides from the session (roadmap 1.9), not Convex calls.

export const E2E_USER_COOKIE = "e2e-user";

/** Signs the browser in as `userId` (pass the test's `baseURL`). Takes effect on the next page load. */
export async function signInAs(
	context: BrowserContext,
	baseURL: string | undefined,
	userId: string,
): Promise<void> {
	if (!baseURL) throw new Error("signInAs needs the test's baseURL");
	await context.addCookies([
		{ name: E2E_USER_COOKIE, value: userId, url: baseURL },
	]);
}
