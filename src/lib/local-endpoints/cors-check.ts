// Who may use a local server, read from its CORS setup (docs/security.md, "Local model servers").
// Browsers hide `Access-Control-Allow-Origin` from scripts unless the server exposes it, and LM Studio
// and Ollama don't. So when the header isn't readable, we ask again as a different website would: from
// a worker started from a `data:` URL, whose origin is opaque (it sends `Origin: null`). If that
// request is allowed too, so is every other website. A `no-cors` request first checks the worker can
// reach the server at all, so a worker that's blocked for another reason never reads as "only us".

export type CorsExposure =
	/** Every website may call the server (`*`, or it echoes any origin). */
	| "any-site"
	/** Our origin works and a foreign one doesn't. */
	| "this-site"
	/** We couldn't tell. */
	| "unknown";

const PROBE_TIMEOUT_MS = 5_000;

const PROBE_WORKER = `
onmessage = async (event) => {
	const url = event.data;
	try {
		await fetch(url, { mode: "no-cors", credentials: "omit" });
	} catch {
		postMessage("unknown");
		return;
	}
	try {
		await fetch(url, { credentials: "omit" });
		postMessage("any-site");
	} catch {
		postMessage("this-site");
	}
};
`;

/** Runs the opaque-origin request against `url` (the server's `/models`). */
export function probeFromOtherOrigin(url: string): Promise<CorsExposure> {
	return new Promise((resolve) => {
		let worker: Worker;
		try {
			worker = new Worker(
				`data:text/javascript,${encodeURIComponent(PROBE_WORKER)}`,
			);
		} catch {
			resolve("unknown");
			return;
		}
		const finish = (result: CorsExposure) => {
			clearTimeout(timer);
			worker.terminate();
			resolve(result);
		};
		const timer = setTimeout(() => finish("unknown"), PROBE_TIMEOUT_MS);
		worker.onmessage = (event: MessageEvent<unknown>) =>
			finish(
				event.data === "any-site" || event.data === "this-site"
					? event.data
					: "unknown",
			);
		worker.onerror = () => finish("unknown");
		worker.postMessage(url);
	});
}

/**
 * `allowOrigin` is the header as our request saw it (null when the server doesn't expose it, which
 * is the usual case). An echo of our origin still gets the probe: some servers echo every origin.
 */
export async function checkCors(
	modelsUrl: string,
	allowOrigin: string | null,
	probe: (url: string) => Promise<CorsExposure> = probeFromOtherOrigin,
): Promise<CorsExposure> {
	if (allowOrigin === "*") return "any-site";
	return probe(modelsUrl);
}
