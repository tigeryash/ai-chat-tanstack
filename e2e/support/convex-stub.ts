import { createHash } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import {
	TEST_CATALOG,
	testCatalogModel,
} from "../../src/lib/models/catalog.fixtures";
import { E2E_USER_COOKIE } from "./accounts";

// Stands in for Convex and its Better Auth endpoints during e2e runs, so tests never touch a real
// deployment and need no secrets. Visitors are signed out unless a test signs one in as a test user
// (see the `e2e-user` cookie below). Run by playwright.config.ts.
// The model catalog's public queries answer from the seeded catalog in src/lib/models/catalog.fixtures.ts.

const port = Number(process.env.CONVEX_STUB_PORT ?? 4175);
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// The app (another port) calls `/api/query` with fetch, so it needs CORS like the real deployment.
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "content-type, convex-client",
	"access-control-allow-methods": "POST, OPTIONS",
};

/** Public query results, by Convex function path. */
const QUERIES: Record<string, (args: Record<string, unknown>) => unknown> = {
	"models:list": () => TEST_CATALOG,
	"models:get": (args) => testCatalogModel(String(args.gatewayId)),
};

/** The signed-in test user's ID from the `e2e-user` cookie, if any. */
function e2eUserOf(request: IncomingMessage): string | undefined {
	for (const pair of (request.headers.cookie ?? "").split(";")) {
		const [name, value] = pair.trim().split("=");
		if (name === E2E_USER_COOKIE && value && /^[\w-]{1,64}$/.test(value)) {
			return value;
		}
	}
	return undefined;
}

/** What Better Auth's `get-session` returns for a signed-in user. */
function sessionFor(userId: string) {
	const now = new Date().toISOString();
	const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
	return {
		session: {
			id: `session-${userId}`,
			userId,
			token: `token-${userId}`,
			expiresAt,
			createdAt: now,
			updatedAt: now,
		},
		user: {
			id: userId,
			name: userId,
			email: `${userId}@example.com`,
			emailVerified: true,
			image: null,
			createdAt: now,
			updatedAt: now,
		},
	};
}

async function readJson(request: IncomingMessage): Promise<unknown> {
	let body = "";
	for await (const chunk of request) body += chunk;
	return JSON.parse(body);
}

async function answerQuery(
	request: IncomingMessage,
): Promise<{ status: number; body: unknown }> {
	const { path, args } = (await readJson(request)) as {
		path?: string;
		args?: Record<string, unknown>[];
	};
	const query = path ? QUERIES[path] : undefined;
	if (!query) {
		console.error(`[convex-stub] unhandled query ${path}`);
		return {
			status: 560,
			body: { status: "error", errorMessage: "Not in the stub" },
		};
	}
	return {
		status: 200,
		body: { status: "success", value: query(args?.[0] ?? {}), logLines: [] },
	};
}

const server = createServer((request, response) => {
	const path = new URL(request.url ?? "/", "http://stub").pathname;

	if (path === "/api/query") {
		if (request.method === "OPTIONS") {
			response.writeHead(204, CORS_HEADERS).end();
			return;
		}
		answerQuery(request)
			.then(({ status, body }) => {
				response.writeHead(status, {
					...CORS_HEADERS,
					"content-type": "application/json",
				});
				response.end(JSON.stringify(body));
			})
			.catch((error) => {
				console.error("[convex-stub] bad query:", error);
				response.writeHead(400, CORS_HEADERS).end();
			});
		return;
	}

	// Better Auth. A test signs in by setting the `e2e-user` cookie (e2e/support/accounts.ts); the app's
	// `/api/auth/*` proxy passes it here. Signed in, `/api/auth/get-session` answers with that user and
	// sign-out clears the cookie. Convex itself stays signed out: `/api/auth/convex/token` and anything
	// else answer `null`.
	if (path === "/api/auth/get-session") {
		const userId = e2eUserOf(request);
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify(userId ? sessionFor(userId) : null));
		return;
	}
	if (path === "/api/auth/sign-out") {
		response.writeHead(200, {
			"content-type": "application/json",
			"set-cookie": `${E2E_USER_COOKIE}=; Path=/; Max-Age=0`,
		});
		response.end(JSON.stringify({ success: true }));
		return;
	}
	if (path.startsWith("/api/auth/")) {
		response.writeHead(200, { "content-type": "application/json" });
		response.end("null");
		return;
	}

	console.error(`[convex-stub] unhandled ${request.method} ${path}`);
	response.writeHead(404).end();
});

// The browser's Convex client opens a sync WebSocket. Accept it and stay silent: signed-out pages
// run no queries, and an open socket keeps the client from logging reconnect errors.
server.on("upgrade", (request, socket) => {
	const key = request.headers["sec-websocket-key"];
	if (typeof key !== "string") {
		socket.destroy();
		return;
	}
	const accept = createHash("sha1")
		.update(key + WEBSOCKET_GUID)
		.digest("base64");
	socket.write(
		"HTTP/1.1 101 Switching Protocols\r\n" +
			"Upgrade: websocket\r\n" +
			"Connection: Upgrade\r\n" +
			`Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
	);
	socket.on("data", () => {});
	socket.on("error", () => {});
});

server.listen(port, "127.0.0.1", () => {
	console.log(`[convex-stub] listening on http://127.0.0.1:${port}`);
});
