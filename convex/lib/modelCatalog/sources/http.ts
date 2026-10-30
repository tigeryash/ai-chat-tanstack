/** What one source gave this run. A failed source is never treated as "no models". */
export type SourceResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string };

export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * GET a JSON document. Throws with a short message naming the host and status, never the request
 * headers (the Artificial Analysis key travels in one).
 */
export async function fetchJson(
	url: string,
	headers: Record<string, string> = {},
): Promise<unknown> {
	const host = new URL(url).host;
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { accept: "application/json", ...headers },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		throw new Error(
			`${host}: request failed (${error instanceof Error ? error.name : "unknown error"})`,
		);
	}
	if (!response.ok) {
		throw new Error(`${host}: HTTP ${response.status}`);
	}
	try {
		return await response.json();
	} catch {
		throw new Error(`${host}: response was not JSON`);
	}
}

/** Runs a source and turns any throw into a failed result. */
export async function runSource<T>(
	load: () => Promise<T>,
): Promise<SourceResult<T>> {
	try {
		return { ok: true, data: await load() };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
