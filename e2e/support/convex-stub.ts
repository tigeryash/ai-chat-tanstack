import { createHash } from "node:crypto";
import { createServer } from "node:http";

// Stands in for Convex and its Better Auth endpoints during e2e runs, so tests never touch a real
// deployment and need no secrets. Every visitor is signed out. Run by playwright.config.ts.

const port = Number(process.env.CONVEX_STUB_PORT ?? 4175);
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const server = createServer((request, response) => {
	const path = new URL(request.url ?? "/", "http://stub").pathname;

	// Better Auth: `/api/auth/get-session` and `/api/auth/convex/token` answer `null` when signed out.
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
