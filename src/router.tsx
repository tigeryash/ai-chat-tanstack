import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { RouteError } from "@/components/route-error";
import { createNonce } from "@/lib/security/csp";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

const getSsrOptions = createIsomorphicFn().server(() => ({
	nonce: createNonce(),
}));

export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: {
			queryClient: rqContext.queryClient,
			convexQueryClient: rqContext.convexQueryClient,
		},
		// A fresh CSP nonce for every server render (getRouter runs once per request). Start puts it
		// on every script it emits, and the root route's `headers` puts it in the policy.
		ssr: getSsrOptions(),
		defaultPreload: "intent",
		scrollRestoration: true,
		defaultErrorComponent: RouteError,
		defaultNotFoundComponent: () => <p>not found</p>,
	});

	// Also wraps the router in QueryClientProvider with this queryClient (its `wrapQueryClient` default).
	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
	});

	return router;
};
