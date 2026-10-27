export type ChatStoreErrorCode =
	| "not-found"
	| "invalid-chat"
	| "too-new"
	| "invalid-export";

// Errors from the chat store carry a code for the UI to pick its own wording, and `issues` that name
// only paths and Zod codes. They never carry message text: AI SDK's validation errors quote the whole
// value they rejected, so they are reduced to `issues` and not attached as `cause` (CLAUDE.md rule 4).
export class ChatStoreError extends Error {
	readonly code: ChatStoreErrorCode;
	readonly chatId: string | undefined;
	readonly issues: readonly string[];

	constructor(
		code: ChatStoreErrorCode,
		message: string,
		details: { chatId?: string; issues?: readonly string[] } = {},
	) {
		super(message);
		this.name = "ChatStoreError";
		this.code = code;
		this.chatId = details.chatId;
		this.issues = details.issues ?? [];
	}
}

interface IssueLike {
	path: readonly PropertyKey[];
	code: string;
}

function isIssueList(value: unknown): value is IssueLike[] {
	return (
		Array.isArray(value) &&
		value.every(
			(issue) =>
				typeof issue === "object" &&
				issue !== null &&
				Array.isArray(issue.path) &&
				typeof issue.code === "string",
		)
	);
}

/** "messages.0.parts.1.type: invalid_union" lines from a Zod error, or one wrapped in `cause`. */
export function issuesOf(error: unknown): string[] {
	let current: unknown = error;
	for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
		const issues = (current as { issues?: unknown }).issues;
		if (isIssueList(issues)) {
			return issues.map(
				(issue) =>
					`${issue.path.map(String).join(".") || "(root)"}: ${issue.code}`,
			);
		}
		current = current.cause;
	}
	return [];
}
