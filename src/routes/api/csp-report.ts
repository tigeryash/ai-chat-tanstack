import { createFileRoute } from "@tanstack/react-router";
import { logWarn } from "@/lib/log";
import {
	MAX_CSP_REPORT_BYTES,
	parseCspReport,
} from "@/lib/security/csp-report";
import { storeCspViolations } from "@/lib/security/csp-report-store";

// Browsers POST CSP violations here (the policy's report-uri). Each one is logged as a single `[csp]`
// line in the server log (Vercel's function logs in production) and counted in Convex
// (`storeCspViolations`; directive, blocked origin and route only). The reply never says whether a
// report was accepted.
export const Route = createFileRoute("/api/csp-report")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await readCappedText(request);
				if (body !== null) {
					const violations = parseCspReport(safeJson(body));
					for (const violation of violations) {
						logWarn(
							`[csp] ${violation.disposition} ${violation.directive} blocked ${violation.blocked} on ${violation.page}`,
						);
					}
					await storeCspViolations(violations);
				}
				return new Response(null, { status: 204 });
			},
		},
	},
});

/** The body as text, or null when it is larger than MAX_CSP_REPORT_BYTES. */
async function readCappedText(request: Request): Promise<string | null> {
	const declared = Number(request.headers.get("content-length") ?? 0);
	if (declared > MAX_CSP_REPORT_BYTES || !request.body) return null;

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_CSP_REPORT_BYTES) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	return new TextDecoder().decode(concat(chunks, size));
}

function concat(chunks: readonly Uint8Array[], size: number): Uint8Array {
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
