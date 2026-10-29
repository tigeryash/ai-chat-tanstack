import { localNetworkAccess, type NetworkAccessState } from "./network-access";

// What a local model server reports at its OpenAI-style `/models`, for Settings' "Test connection"
// and the picker's "Local" group. Local models come only from here, never from the catalog.

export type ListFailure =
	/** Chrome's Local Network Access permission is blocked for this site. */
	| "denied"
	/** No answer: the server is off, the port is wrong, or CORS isn't enabled. */
	| "unreachable"
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

/** Model ids from an OpenAI-style list (`{ data: [{ id }] }`) or a bare array. */
export function modelIdsFrom(body: unknown): string[] | null {
	const list = Array.isArray(body)
		? body
		: (body as { data?: unknown } | null)?.data;
	if (!Array.isArray(list)) return null;
	return list
		.map((model) => (model as { id?: unknown } | null)?.id)
		.filter((id): id is string => typeof id === "string");
}

export interface ListDeps {
	fetch?: typeof fetch;
	networkAccess?: () => Promise<NetworkAccessState>;
}

/** The server's model ids, sorted. Sends no key, no cookies and no Referer path. */
export async function listLocalModels(
	baseUrl: string,
	{
		fetch: fetchImpl = fetch,
		networkAccess = localNetworkAccess,
	}: ListDeps = {},
): Promise<ModelList> {
	let response: Response;
	try {
		response = await fetchImpl(`${baseUrl}/models`, {
			credentials: "omit",
			referrerPolicy: "origin",
		});
	} catch {
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
	} catch {
		ids = null;
	}
	if (!ids) return { ok: false, reason: "bad-response" };
	return {
		ok: true,
		models: [...new Set(ids)].sort(),
		allowOrigin: response.headers.get("access-control-allow-origin"),
	};
}
