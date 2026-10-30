import { test as base, expect } from "@playwright/test";
import { testEndpointsFor } from "../../src/lib/hosts/test-endpoints";
import { E2E_ENFORCE_CSP_COOKIE } from "../../src/lib/security/csp";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The routers' public endpoint APIs (roadmap 2.2b), which the picker calls when it opens. */
const ENDPOINT_APIS = [
	{
		source: "openrouter",
		pattern: /^https:\/\/openrouter\.ai\/api\/v1\/models\/(.+)\/endpoints$/,
	},
	{
		source: "gateway",
		pattern: /^https:\/\/ai-gateway\.vercel\.sh\/v1\/models\/(.+)\/endpoints$/,
	},
] as const;

/** Fixture data for a GET to one of the endpoint APIs; undefined for any other request. */
function fakeEndpointApi(url: string, method: string) {
	if (method !== "GET") return undefined;
	for (const { source, pattern } of ENDPOINT_APIS) {
		const match = pattern.exec(url.split("?")[0] ?? "");
		if (match?.[1]) {
			return {
				headers: { "access-control-allow-origin": "*" },
				json: testEndpointsFor(source, decodeURIComponent(match[1])),
			};
		}
	}
	return undefined;
}

export interface CspViolation {
	directive: string;
	blocked: string;
	disposition: string;
	source: string;
}

declare global {
	interface Window {
		__reportCspViolation?: (violation: CspViolation) => void;
	}
}

// Every e2e test gets these guards automatically:
// - Requests may only go to this machine (the app under test and the Convex stub). Anything else, such
//   as a model provider, a CDN, or analytics, is aborted and fails the test, so e2e can never call a
//   real model or send data out. Chat tests use the AI SDK mock model from `ai/test` instead.
//   The routers' public endpoint APIs are answered here with fixture data (src/lib/hosts/
//   test-endpoints.ts) and never reach the network; a test can override them with `page.route`.
// - An uncaught error in the page fails the test.
// - Any Content Security Policy violation, report-only included, fails the test: the CSP report must
//   stay clean in normal use (roadmap 1.0). Tests that provoke one on purpose read `cspViolations`
//   and set `allowCspViolations`.
// - With `enforceStrictCsp` (the `csp-enforced` project), the server enforces every page's strict policy,
//   as it will once ENFORCE_STRICT_CSP (src/lib/security/csp.ts) is on.
export const test = base.extend<{
	guards: undefined;
	cspViolations: CspViolation[];
	allowCspViolations: boolean;
	enforceStrictCsp: boolean;
}>({
	allowCspViolations: [false, { option: true }],
	enforceStrictCsp: [false, { option: true }],
	cspViolations: async ({ context }, use) => {
		const violations: CspViolation[] = [];
		await context.exposeBinding("__reportCspViolation", (_, violation) => {
			violations.push(violation as CspViolation);
		});
		await context.addInitScript(() => {
			document.addEventListener("securitypolicyviolation", (event) => {
				window.__reportCspViolation?.({
					directive: event.effectiveDirective,
					blocked: event.blockedURI,
					disposition: event.disposition,
					source: `${event.sourceFile}:${event.lineNumber}`,
				});
			});
		});
		await use(violations);
	},
	guards: [
		async (
			{
				context,
				page,
				baseURL,
				cspViolations,
				allowCspViolations,
				enforceStrictCsp,
			},
			use,
		) => {
			if (enforceStrictCsp) {
				await context.addCookies([
					{ name: E2E_ENFORCE_CSP_COOKIE, value: "1", url: baseURL },
				]);
			}
			const externalRequests: string[] = [];
			const pageErrors: string[] = [];

			await context.route("**/*", (route) => {
				const url = route.request().url();
				if (LOCAL_HOSTNAMES.has(new URL(url).hostname)) {
					return route.continue();
				}
				const fake = fakeEndpointApi(url, route.request().method());
				if (fake) return route.fulfill(fake);
				externalRequests.push(url);
				return route.abort("blockedbyclient");
			});
			page.on("pageerror", (error) => {
				pageErrors.push(error.message);
			});

			await use(undefined);

			expect(externalRequests, "requests that left this machine").toEqual([]);
			expect(pageErrors, "uncaught errors in the page").toEqual([]);
			if (!allowCspViolations) {
				expect(cspViolations, "Content Security Policy violations").toEqual([]);
			}
		},
		{ auto: true },
	],
});

export { expect };
