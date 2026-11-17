// The sign-in methods the app offers (convex/auth.ts) and which of them an account has linked, from
// Better Auth's `listAccounts` (roadmap R2 S8). Better Auth names email and password "credential".

export const SIGN_IN_METHODS = [
	{ providerId: "credential", label: "Email and password" },
	{ providerId: "google", label: "Google" },
	{ providerId: "github", label: "GitHub" },
	{ providerId: "discord", label: "Discord" },
] as const;

export type SignInMethodId = (typeof SIGN_IN_METHODS)[number]["providerId"];

export interface SignInMethodStatus {
	providerId: SignInMethodId;
	label: string;
	linked: boolean;
}

/** Every method the app offers, in sign-in page order, marked linked when the account has it. */
export function signInMethodStatuses(
	linkedProviderIds: readonly string[],
): SignInMethodStatus[] {
	const linked = new Set(linkedProviderIds);
	return SIGN_IN_METHODS.map(({ providerId, label }) => ({
		providerId,
		label,
		linked: linked.has(providerId),
	}));
}

/** Up to two letters for an avatar: the first letters of the first two words of the name, else of the email. */
export function initialsOf(name: string, email: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const letters =
		words.length > 0
			? words
					.slice(0, 2)
					.map((word) => Array.from(word)[0] ?? "")
					.join("")
			: (Array.from(email.trim())[0] ?? "");
	return letters.toUpperCase() || "?";
}
