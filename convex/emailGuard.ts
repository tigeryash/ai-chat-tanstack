import { APIError, createAuthMiddleware } from "better-auth/api";
import { EmailNotConfiguredError, missingEmailEnv } from "./email";

// Better Auth routes that exist to send an email.
const EMAIL_SENDING_PATHS = new Set(["/sign-up/email", "/request-password-reset", "/send-verification-email"]);

/**
 * Better Auth `hooks.before`. A failed send on sign-up or a reset request is caught and only logged by
 * Better Auth, which still reports success (and creates the user on sign-up). So when this deployment
 * can't send email, refuse those requests up front, and log which env vars are missing (names only).
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
