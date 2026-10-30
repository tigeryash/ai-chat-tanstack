import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "@convex/lib/passwordPolicy";
import { z } from "@/lib/zod";

// Better Auth sets no limit on names. This one only stops a pasted essay.
export const MAX_NAME_LENGTH = 100;

const email = z.string().trim().email("Enter a valid email address");

// Same limits as Better Auth on the server (convex/auth.ts). Never trimmed: spaces are part of a password.
const password = z
	.string()
	.min(
		MIN_PASSWORD_LENGTH,
		`Use at least ${MIN_PASSWORD_LENGTH} characters for your password`,
	)
	.max(
		MAX_PASSWORD_LENGTH,
		`Use at most ${MAX_PASSWORD_LENGTH} characters for your password`,
	);

export const loginSchema = z.object({ email, password });

export const signupSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Enter your name")
		.max(MAX_NAME_LENGTH, `Use at most ${MAX_NAME_LENGTH} characters`),
	email,
	password,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password });

// `/reset-password` search params. Better Auth's emailed link checks the token, then redirects here with
// `?token=…`, or with `?error=INVALID_TOKEN` when it's unknown or expired. Anything else counts as missing.
export const resetPasswordSearchSchema = z.object({
	token: z.string().min(1).optional().catch(undefined),
	error: z.string().optional().catch(undefined),
});

// The codes Better Auth's verify-email endpoint adds when a verification link fails: it redirects to the
// sign-up `callbackURL` (`/login`) with `?error=<code>`.
export const VERIFY_LINK_ERRORS = [
	"TOKEN_EXPIRED",
	"INVALID_TOKEN",
	"USER_NOT_FOUND",
	"INVALID_USER",
] as const;

export type VerifyLinkError = (typeof VERIFY_LINK_ERRORS)[number];

// `/login` search params. Only the known codes are read, so the page picks its own message and never shows
// text from the URL. Anything else counts as no error.
export const loginSearchSchema = z.object({
	error: z.enum(VERIFY_LINK_ERRORS).optional().catch(undefined),
});

/** A failed parse as Base UI `Form` errors: field name → messages, for fields that have any. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
	return Object.fromEntries(
		Object.entries(z.flattenError(error).fieldErrors).filter(
			(entry): entry is [string, string[]] => entry[1] !== undefined,
		),
	);
}
