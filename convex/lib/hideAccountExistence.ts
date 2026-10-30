import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";

/**
 * Minimum response time for each Better Auth route whose work depends on whether an account exists.
 * With emails queued rather than sent (convex/email.ts `queueEmail`), each route's slow path is our own
 * database work: the reset token insert, and sign-up's user and account inserts after the password hash
 * both paths do. A floor must stay above that slow path, or the difference shows again; the after hook
 * logs a warning when a request runs past it. Better Auth's `/send-verification-email` has its own floor.
 */
export const RESPONSE_FLOOR_MS = {
	"/request-password-reset": 500,
	"/sign-up/email": 1000,
} as const;

/**
 * What `/sign-up/email` answers on success. With `requireEmailVerification`, Better Auth answers a taken
 * address with a made-up user, but its shape gives it away (dates as strings, extra null fields, an id
 * in a different format). Nobody is signed in until they verify, so the real user isn't needed either.
 */
export const SIGN_UP_RESPONSE = { token: null, user: null } as const;

const floors = new Map<string | undefined, number>(
	Object.entries(RESPONSE_FLOOR_MS),
);

// When each request on a floored route started, keyed by the per-call Better Auth context object that its
// before and after hooks share (better-auth 1.6 `dispatchAuthEndpoint`). convex/auth.test.ts checks that.
const startedAt = new WeakMap<object, number>();

/**
 * Better Auth plugin: sign-up and password-reset responses look and take the same whether or not the
 * address has an account (docs/security.md, "Accounts").
 */
export const hideAccountExistence = () =>
	({
		id: "hide-account-existence",
		hooks: {
			before: [
				{
					matcher: (ctx) => floors.has(ctx.path),
					handler: createAuthMiddleware(async (ctx) => {
						startedAt.set(ctx.context, Date.now());
					}),
				},
			],
			// After hooks run in order, so the floor comes last and covers the rewrite too.
			after: [
				{
					matcher: (ctx) => ctx.path === "/sign-up/email",
					handler: createAuthMiddleware(async (ctx) => {
						if (isAPIError(ctx.context.returned)) return;
						return ctx.json(SIGN_UP_RESPONSE);
					}),
				},
				{
					matcher: (ctx) => floors.has(ctx.path),
					handler: createAuthMiddleware(async (ctx) => {
						await waitOutFloor(ctx.path, startedAt.get(ctx.context));
					}),
				},
			],
		},
	}) satisfies BetterAuthPlugin;

// Logs name the route and durations only, never the address.
async function waitOutFloor(path: string, start: number | undefined) {
	const floor = floors.get(path);
	if (floor === undefined) return;
	if (start === undefined) {
		console.error(
			`No start time for ${path}, so its response-time floor was skipped.`,
		);
		return;
	}
	const elapsed = Date.now() - start;
	if (elapsed > floor) {
		console.warn(
			`${path} took ${elapsed} ms, past its ${floor} ms floor. Raise RESPONSE_FLOOR_MS in convex/lib/hideAccountExistence.ts.`,
		);
		return;
	}
	await new Promise((resolve) => setTimeout(resolve, floor - elapsed));
}
