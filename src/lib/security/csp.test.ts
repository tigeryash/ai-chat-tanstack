import { describe, expect, it } from "vitest";
import {
	buildStrictCsp,
	CSP_REPORT_PATH,
	createNonce,
	cspHeaders,
	ENFORCED_CSP,
} from "@/lib/security/csp";
import { parseCspReport } from "@/lib/security/csp-report";
import { PROVIDER_API_ORIGINS } from "@/lib/security/provider-origins";

function directives(policy: string): Map<string, string[]> {
	return new Map(
		policy.split("; ").map((directive) => {
			const [name = "", ...sources] = directive.split(" ");
			return [name, sources];
		}),
	);
}

describe("buildStrictCsp", () => {
	const policy = directives(
		buildStrictCsp({
			nonce: "abc123",
			convexUrls: [
				"https://happy-otter-1.convex.cloud",
				"https://happy-otter-1.convex.site/",
				undefined,
			],
		}),
	);

	it("allows scripts only by nonce, with no eval or inline", () => {
		expect(policy.get("script-src")).toEqual([
			"'nonce-abc123'",
			"'strict-dynamic'",
		]);
	});

	it("limits connect-src to us, Convex, the providers, and local servers", () => {
		expect(policy.get("connect-src")).toEqual([
			"'self'",
			"https://happy-otter-1.convex.cloud",
			"wss://happy-otter-1.convex.cloud",
			"https://happy-otter-1.convex.site",
			"wss://happy-otter-1.convex.site",
			...PROVIDER_API_ORIGINS,
			"http://localhost:*",
			"http://127.0.0.1:*",
		]);
	});

	it("blocks plugins, base tags, framing, and remote images", () => {
		expect(policy.get("object-src")).toEqual(["'none'"]);
		expect(policy.get("base-uri")).toEqual(["'none'"]);
		expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
		expect(policy.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
	});

	it("reports to the CSP endpoint", () => {
		expect(policy.get("report-uri")).toEqual([CSP_REPORT_PATH]);
	});

	it("allows Vite's HMR socket only in dev", () => {
		const dev = directives(
			buildStrictCsp({ nonce: "n", convexUrls: [], dev: true }),
		);
		expect(dev.get("connect-src")).toContain("ws://localhost:*");
		expect(policy.get("connect-src")).not.toContain("ws://localhost:*");
	});

	it("sends the strict policy as report-only and the safe subset enforced", () => {
		const headers = cspHeaders({ nonce: "n", convexUrls: [] });
		expect(headers["Content-Security-Policy"]).toBe(ENFORCED_CSP);
		expect(headers["Content-Security-Policy-Report-Only"]).toContain(
			"'nonce-n'",
		);
	});
});

describe("createNonce", () => {
	it("makes a fresh 128-bit base64 value each time", () => {
		const first = createNonce();
		expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		expect(createNonce()).not.toBe(first);
	});
});

describe("parseCspReport", () => {
	it("keeps only directive, blocked origin and path from a report-uri body", () => {
		expect(
			parseCspReport({
				"csp-report": {
					"document-uri": "https://app.test/reset-password?token=secret",
					"violated-directive": "script-src-elem",
					"blocked-uri": "https://evil.test/x.js?k=v",
					"script-sample": "alert(document.cookie)",
					disposition: "report",
				},
			}),
		).toEqual([
			{
				directive: "script-src-elem",
				blocked: "https://evil.test",
				page: "/reset-password",
				disposition: "report",
			},
		]);
	});

	it("reads Reporting API batches and skips other report types", () => {
		expect(
			parseCspReport([
				{
					type: "csp-violation",
					body: {
						documentURL: "https://app.test/login",
						effectiveDirective: "script-src",
						blockedURL: "eval",
						disposition: "enforce",
					},
				},
				{ type: "deprecation", body: {} },
			]),
		).toEqual([
			{
				directive: "script-src",
				blocked: "eval",
				page: "/login",
				disposition: "enforce",
			},
		]);
	});

	it("ignores junk", () => {
		expect(parseCspReport(null)).toEqual([]);
		expect(parseCspReport({ hello: "world" })).toEqual([]);
		expect(parseCspReport("text")).toEqual([]);
	});
});
