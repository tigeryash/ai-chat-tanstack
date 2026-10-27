import { APICallError, RetryError } from "ai";

// What a failed chat request tells the person. Provider error bodies and messages can quote the request
// (the user's messages) or part of the key, so they are never shown or logged: only the status is read.

/** A problem with the chat's setup (no model, no key) whose message is safe to show as is. */
export class ChatSetupError extends Error {
	override name = "ChatSetupError";
}

function statusOf(error: unknown): number | undefined {
	const cause = RetryError.isInstance(error) ? error.lastError : error;
	return APICallError.isInstance(cause) ? cause.statusCode : undefined;
}

/** A short, content-free explanation of `error`, naming the provider it came from. */
export function describeChatError(
	error: unknown,
	providerName: string,
): string {
	if (error instanceof ChatSetupError) return error.message;
	const status = statusOf(error);
	if (status === 401 || status === 403) {
		return `${providerName} rejected the key. Check it in Settings.`;
	}
	if (status === 402) {
		return `${providerName} says the account is out of credits.`;
	}
	if (status === 404) {
		return `${providerName} doesn't know that model. Check the model name.`;
	}
	if (status === 429) {
		return `${providerName} is rate-limiting requests. Wait a moment and try again.`;
	}
	if (status !== undefined && status >= 500) {
		return `${providerName} had an error. Try again.`;
	}
	if (status !== undefined) {
		return `${providerName} turned the request down (HTTP ${status}). The model may not support this chat.`;
	}
	if (error instanceof TypeError) {
		// fetch rejects with a TypeError when it can't connect, including CORS failures.
		return `Couldn't reach ${providerName}. Check your connection. A local server needs to be running with CORS enabled.`;
	}
	return `The request to ${providerName} failed.`;
}

/** What may be logged about `error`: its name and HTTP status, nothing else. */
export function chatErrorLogFields(error: unknown) {
	return {
		name: error instanceof Error ? error.name : typeof error,
		status: statusOf(error),
	};
}
