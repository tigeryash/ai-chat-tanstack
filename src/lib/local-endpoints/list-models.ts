import { MODEL_ID_MAX } from "@/lib/chat/model-selection";
import { localNetworkAccess, type NetworkAccessState } from "./network-access";

// What a local model server reports at its OpenAI-style `/models`, for Settings' "Test connection"
// and the picker's "Local" group. Local models come only from here, never from the catalog.

/** How long a server gets to answer, body included, before the list gives up. */
export const LIST_TIMEOUT_MS = 5_000;
/** The most ids kept from one server (the first ones it reports), so a huge list can't swamp the UI. */
export const MAX_LOCAL_MODELS = 1_000;

export type ListFailure =
	/** Chrome's Local Network Access permission is blocked for this site. */
	| "denied"
	/** No answer: the server is off, the port is wrong, or CORS isn't enabled. */
	| "unreachable"
	/** Connected, but no full answer within LIST_TIMEOUT_MS. */
	| "timed-out"
	/** An HTTP error, or a body that isn't a model list. */
	| "bad-response";

export type ModelList =
	| {
			ok: true;
			models: string[];
			/** `Access-Control-Allow-Origin`, when the server exposes it to scripts (most don't). */
			allowOrigin: string | null;
	  }
	| { ok: false; reason: ListFailure; status?: number };

/**
 * Model ids from an OpenAI-style list (`{ data: [{ id }] }`) or a bare array. Ids a `ModelChoice`
 * can't hold (empty, or over MODEL_ID_MAX) are dropped, so every listed model can be picked.
 */
export function modelIdsFrom(body: unknown): string[] | null {
	const list = Array.isArray(body)
		? body
		: (body as { data?: unknown } | null)?.data;
	if (!Array.isArray(list)) return null;
	return list
		.map((model) => (model as { id?: unknown } | null)?.id)
		.filter(
			(id): id is string =>
				typeof id === "string" &&
				id.trim().length > 0 &&
				id.length <= MODEL_ID_MAX,
		);
}

export interface ListDeps {
	fetch?: typeof fetch;
	networkAccess?: () => Promise<NetworkAccessState>;
	/** For tests; defaults to LIST_TIMEOUT_MS. */
	timeoutMs?: number;
}

function isTimeout(error: unknown): boolean {
	return error instanceof DOMException && error.name === "TimeoutError";
}

/** The server's model ids, sorted. Sends no key, no cookies and no Referer path. */
export async function listLocalModels(
	baseUrl: string,
	{
		fetch: fetchImpl = fetch,
		networkAccess = localNetworkAccess,
		timeoutMs = LIST_TIMEOUT_MS,
	}: ListDeps = {},
): Promise<ModelList> {
	let response: Response;
	try {
		response = await fetchImpl(`${baseUrl}/models`, {
			credentials: "omit",
			referrerPolicy: "origin",
			// Also cuts off a body that never finishes: the signal covers reading it.
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		if (isTimeout(error)) return { ok: false, reason: "timed-out" };
		// A blocked permission and a stopped server both look like a network error.
		const access = await networkAccess().catch(() => "unknown" as const);
		return {
			ok: false,
			reason: access === "denied" ? "denied" : "unreachable",
		};
	}
	if (!response.ok) {
		return { ok: false, reason: "bad-response", status: response.status };
	}
	let ids: string[] | null;
	try {
		ids = modelIdsFrom(await response.json());
	} catch (error) {
		if (isTimeout(error)) return { ok: false, reason: "timed-out" };
		ids = null;
	}
	if (!ids) return { ok: false, reason: "bad-response" };
	return {
		ok: true,
		models: [...new Set(ids)].slice(0, MAX_LOCAL_MODELS).sort(),
		allowOrigin: response.headers.get("access-control-allow-origin"),
	};
}
