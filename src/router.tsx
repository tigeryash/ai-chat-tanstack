// Must stay the first import: it switches Zod off eval before any schema runs.
import "@/lib/zod-jitless";
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
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<TanstackQuery.Provider queryClient={rqContext.queryClient}>
					{props.children}
				</TanstackQuery.Provider>
			);
		},
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
	});

	return router;
};
