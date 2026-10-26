import { logError } from "@/lib/log";

// What the auth forms read from a Better Auth client error.
export interface AuthError {
	status: number;
	code?: string;
	message?: string;
}

// Stands in for a request that never got an answer (offline, DNS, CORS).
export const NETWORK_ERROR_STATUS = 0;

export const AUTH_MESSAGES = {
	// convex/emailGuard.ts answers 503 when this deployment can't send email.
	emailUnavailable:
		"Email sign-up and password reset aren't available right now. Try again later, or continue with Google, GitHub or Discord.",
	rateLimited: "Too many attempts. Wait a minute, then try again.",
	network: "Couldn't reach the server. Check your connection and try again.",
} as const;

/**
 * Runs a Better Auth client call and never throws: a request that fails before any response comes
 * back as an error with status 0. Resolves to `null` when the call succeeded.
 */
export async function requestAuth(
	call: () => Promise<{ error: AuthError | null }>,
): Promise<AuthError | null> {
	try {
		const { error } = await call();
		return error;
	} catch (error) {
		// Only the error's name: the message of a failed request can quote its URL.
		logError(
			"Auth request failed:",
			error instanceof Error ? error.name : "unknown",
		);
		return { status: NETWORK_ERROR_STATUS };
	}
}

/** The message a form shows for a failed request. `fallback` covers everything not listed here. */
export function authErrorMessage(error: AuthError, fallback: string): string {
	switch (error.status) {
		case NETWORK_ERROR_STATUS:
			return AUTH_MESSAGES.network;
		case 429:
			return AUTH_MESSAGES.rateLimited;
		case 503:
			return AUTH_MESSAGES.emailUnavailable;
		default:
			return fallback;
	}
}
