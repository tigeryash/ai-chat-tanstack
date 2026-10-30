import { APIError, createAuthMiddleware } from "better-auth/api";
import { EmailNotConfiguredError, missingEmailEnv } from "./email";

// Better Auth routes that exist to send an email.
const EMAIL_SENDING_PATHS = new Set([
	"/sign-up/email",
	"/request-password-reset",
	"/send-verification-email",
]);

/**
 * Better Auth `hooks.before`. Sign-up and reset emails are sent outside the request, from a scheduled
 * action (`queueEmail`), so a failed send can't reach the person: they'd see success (and on sign-up, an
 * account would be created) for an email that never comes. So when this deployment can't send email,
 * refuse those requests up front, and log which env vars are missing (names only). The check doesn't
 * depend on the address, so a 503 reveals nothing about which accounts exist.
 */
export const requireEmailConfigured = createAuthMiddleware(async (ctx) => {
	if (!EMAIL_SENDING_PATHS.has(ctx.path)) return;
	const missing = missingEmailEnv();
	if (missing.length === 0) return;
	console.error(new EmailNotConfiguredError(missing).message);
	throw new APIError("SERVICE_UNAVAILABLE", {
		message: "Email sign-up and password reset are unavailable right now.",
	});
});
