import { test as base, expect } from "@playwright/test";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Every e2e test gets these guards automatically:
// - Requests may only go to this machine (the app under test and the Convex stub). Anything else, such
//   as a model provider, a CDN, or analytics, is aborted and fails the test, so e2e can never call a
//   real model or send data out. Chat tests use the AI SDK mock model from `ai/test` instead.
// - An uncaught error in the page fails the test.
export const test = base.extend<{ guards: undefined }>({
	guards: [
		async ({ context, page }, use) => {
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
		},
		{ auto: true },
	],
});

export { expect };
