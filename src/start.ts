import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";
import {
	E2E_ENFORCE_CSP_COOKIE,
	withStrictCspEnforced,
} from "@/lib/security/csp";
import { withSecurityHeaders } from "@/lib/security/headers";

// Start runs these on every request it handles: pages, server functions, and `src/routes/api/*`.

// Start's default when no `start.ts` exists: server-function calls must come from our own origin.
// Defining `requestMiddleware` here replaces that default, so it is listed again.
const serverFnCsrf = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

const securityHeaders = createMiddleware().server(async ({ next }) => {
	const result = await next();
	return { ...result, response: withSecurityHeaders(result.response) };
});

// e2e's `csp-enforced` project: enforces the strict CSP when its cookie is set. The check is on
// `import.meta.env.VITE_E2E` so that normal production builds drop it entirely.
const e2eEnforcedCsp = createMiddleware().server(async ({ request, next }) => {
	const result = await next();
	if (
		import.meta.env.VITE_E2E !== "true" ||
		!request.headers.get("cookie")?.includes(`${E2E_ENFORCE_CSP_COOKIE}=1`)
	) {
		return result;
	}
	return { ...result, response: withStrictCspEnforced(result.response) };
});

export const startInstance = createStart(() => ({
	requestMiddleware: [serverFnCsrf, securityHeaders, e2eEnforcedCsp],
}));
