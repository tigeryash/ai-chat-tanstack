import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";

// The local model servers this browser talks to (roadmap 2.3): LM Studio, Ollama, or any
// OpenAI-compatible server. Kept in localStorage; an endpoint holds no key and no chat content.
// Nothing calls an endpoint until the user has saved one (docs/security.md, "Local model servers").

export const ENDPOINT_KINDS = ["lmstudio", "ollama", "custom"] as const;
export type EndpointKind = (typeof ENDPOINT_KINDS)[number];

export const ENDPOINT_PRESETS: Record<
	EndpointKind,
	{ name: string; baseUrl: string }
> = {
	lmstudio: { name: "LM Studio", baseUrl: "http://localhost:1234/v1" },
	ollama: { name: "Ollama", baseUrl: "http://localhost:11434/v1" },
	custom: { name: "Custom server", baseUrl: "http://localhost:8080/v1" },
};

/**
 * The hosts the CSP's `connect-src` allows (src/lib/security/provider-origins.ts). Any other address,
 * a LAN IP included, is refused when saving: once the CSP is enforced the browser would block it, and
 * widening `connect-src` to the whole network would let an injected script send data anywhere on it.
 */
const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

const ID_MAX = 64;
const NAME_MAX = 60;
const URL_MAX = 300;
export const MAX_ENDPOINTS = 10;

export type BaseUrlCheck =
	| { ok: true; url: string }
	| { ok: false; error: string };

/** A base URL as stored (no trailing slash), or why it can't be used. */
export function checkBaseUrl(input: string): BaseUrlCheck {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return {
			ok: false,
			error: "Enter a full URL, like http://localhost:1234/v1.",
		};
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return { ok: false, error: "Use an http:// or https:// URL." };
	}
	if (!ALLOWED_HOSTNAMES.has(url.hostname)) {
		return {
			ok: false,
			error:
				"Only localhost and 127.0.0.1 work. This site's security policy blocks other addresses, LAN ones included, so an injected script can't reach other devices. For a server on another machine, forward a local port to it (for example ssh -L 1234:localhost:1234 that-machine).",
		};
	}
	if (url.username || url.password || url.search || url.hash) {
		return {
			ok: false,
			error: "Leave out sign-in details, ? queries and # parts.",
		};
	}
	const clean = `${url.origin}${url.pathname}`.replace(/\/+$/, "");
	if (clean.length > URL_MAX)
		return { ok: false, error: "That URL is too long." };
	return { ok: true, url: clean };
}

export const localEndpointSchema = z.object({
	id: z.string().min(1).max(ID_MAX),
	kind: z.enum(ENDPOINT_KINDS),
	name: z.string().trim().min(1).max(NAME_MAX),
	baseUrl: z
		.string()
		.max(URL_MAX)
		.refine((value) => checkBaseUrl(value).ok, "Not an allowed local URL"),
	/** The user dismissed the "every website can use this server" warning for this endpoint. */
	hideCorsWarning: z.boolean().optional(),
});
export type LocalEndpoint = z.infer<typeof localEndpointSchema>;

export const LOCAL_ENDPOINTS_STORAGE_KEY = "highelo-local-endpoints";

const store = createLocalStore<LocalEndpoint[]>(
	LOCAL_ENDPOINTS_STORAGE_KEY,
	z.array(localEndpointSchema).max(MAX_ENDPOINTS),
	[],
);

export function readLocalEndpoints(): LocalEndpoint[] {
	return store.read();
}

export function useLocalEndpoints(): LocalEndpoint[] {
	return store.use();
}

export function findLocalEndpoint(
	id: string | undefined,
): LocalEndpoint | undefined {
	return id === undefined
		? undefined
		: readLocalEndpoints().find((endpoint) => endpoint.id === id);
}

/** The endpoint a local choice runs on: its own, or for choices made before 2.3, the first saved. */
export function localEndpointFor(
	id: string | undefined,
): LocalEndpoint | undefined {
	return id === undefined ? readLocalEndpoints()[0] : findLocalEndpoint(id);
}

/** `localEndpointFor`, re-rendering when the saved endpoints change. */
export function useLocalEndpointFor(
	id: string | undefined,
): LocalEndpoint | undefined {
	const endpoints = useLocalEndpoints();
	return id === undefined
		? endpoints[0]
		: endpoints.find((endpoint) => endpoint.id === id);
}

export interface EndpointDraft {
	kind: EndpointKind;
	name: string;
	baseUrl: string;
}

function newId(): string {
	return `ep-${crypto.randomUUID().slice(0, 8)}`;
}

/** Saves a new endpoint and returns it. Throws if the URL isn't allowed or the list is full. */
export function addLocalEndpoint(draft: EndpointDraft): LocalEndpoint {
	const current = readLocalEndpoints();
	if (current.length >= MAX_ENDPOINTS) {
		throw new Error(`You can save up to ${MAX_ENDPOINTS} local endpoints.`);
	}
	const endpoint = toEndpoint(newId(), draft);
	store.write([...current, endpoint]);
	return endpoint;
}

/** Changes an endpoint's kind, name or URL, keeping its id (chats point at the id). */
export function updateLocalEndpoint(id: string, draft: EndpointDraft): void {
	const next = toEndpoint(id, draft);
	store.write(
		readLocalEndpoints().map((endpoint) => {
			if (endpoint.id !== id) return endpoint;
			// A new URL is a new server: its CORS setup gets checked (and warned about) again.
			return endpoint.baseUrl === next.baseUrl && endpoint.hideCorsWarning
				? { ...next, hideCorsWarning: true }
				: next;
		}),
	);
}

export function hideCorsWarning(id: string): void {
	store.write(
		readLocalEndpoints().map((endpoint) =>
			endpoint.id === id ? { ...endpoint, hideCorsWarning: true } : endpoint,
		),
	);
}

export function removeLocalEndpoint(id: string): void {
	store.write(readLocalEndpoints().filter((endpoint) => endpoint.id !== id));
}

function toEndpoint(id: string, draft: EndpointDraft): LocalEndpoint {
	const checked = checkBaseUrl(draft.baseUrl);
	if (!checked.ok) throw new Error(checked.error);
	return localEndpointSchema.parse({
		id,
		kind: draft.kind,
		name: draft.name.trim() || ENDPOINT_PRESETS[draft.kind].name,
		baseUrl: checked.url,
	});
}

/** "localhost:1234", for labels. */
export function endpointHost(endpoint: Pick<LocalEndpoint, "baseUrl">): string {
	return new URL(endpoint.baseUrl).host;
}
