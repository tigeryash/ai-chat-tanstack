import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";
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

export const startInstance = createStart(() => ({
	requestMiddleware: [serverFnCsrf, securityHeaders],
}));
