import { test as base, expect } from "@playwright/test";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

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
// - An uncaught error in the page fails the test.
// - Any Content Security Policy violation, report-only included, fails the test: the CSP report must
//   stay clean in normal use (roadmap 1.0). Tests that provoke one on purpose read `cspViolations`
//   and set `allowCspViolations`.
export const test = base.extend<{
	guards: undefined;
	cspViolations: CspViolation[];
	allowCspViolations: boolean;
}>({
	allowCspViolations: [false, { option: true }],
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
		async ({ context, page, cspViolations, allowCspViolations }, use) => {
			const externalRequests: string[] = [];
			const pageErrors: string[] = [];

			await context.route("**/*", (route) => {
				const url = route.request().url();
				if (LOCAL_HOSTNAMES.has(new URL(url).hostname)) {
					return route.continue();
				}
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
