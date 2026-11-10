import { logError } from "@/lib/log";
import {
	finishOpenRouterConnect,
	OpenRouterConnectError,
	readOpenRouterCallback,
	withoutOpenRouterCallback,
} from "./openrouter-oauth";
import { saveProviderKey } from "./vault";

// The OpenRouter OAuth callback page (`/settings`, and `/e2e/keys` in tests) finishes the connection,
// then shows Settings → Connections. The outcome waits here for the Connect OpenRouter row to show it.

/** Where OpenRouter sends the browser back to. Settings itself is a dialog on any page now. */
export const OPENROUTER_CALLBACK_PATH = "/settings";

export interface OpenRouterConnectOutcome {
	kind: "done" | "error";
	message: string;
}

let outcome: OpenRouterConnectOutcome | null = null;

/** The last callback's outcome, until `clearOpenRouterConnectOutcome`. */
export function openRouterConnectOutcome(): OpenRouterConnectOutcome | null {
	return outcome;
}

export function clearOpenRouterConnectOutcome() {
	outcome = null;
}

async function connect(
	callback: NonNullable<ReturnType<typeof readOpenRouterCallback>>,
): Promise<OpenRouterConnectOutcome> {
	try {
		const { key, mode } = await finishOpenRouterConnect(callback);
		await saveProviderKey("openrouter", key, mode, "openrouter-oauth");
		return { kind: "done", message: "OpenRouter is connected." };
	} catch (error) {
		if (error instanceof OpenRouterConnectError) {
			return { kind: "error", message: error.message };
		}
		logError("Couldn't finish connecting OpenRouter:", error);
		return {
			kind: "error",
			message: "Couldn't save the OpenRouter key in this browser.",
		};
	}
}

/**
 * When this page is OpenRouter's callback (`?code=`), trades the code for a key and saves it. The code
 * leaves the address bar and history before anything else runs. Resolves to whether it was a callback.
 * Call once per page load: the verifier is single-use, so a second call reports a planted callback.
 */
export async function completeOpenRouterCallback(): Promise<boolean> {
	const url = new URL(window.location.href);
	const callback = readOpenRouterCallback(url);
	if (!callback) return false;
	window.history.replaceState(
		window.history.state,
		"",
		withoutOpenRouterCallback(url),
	);
	outcome = await connect(callback);
	return true;
}
