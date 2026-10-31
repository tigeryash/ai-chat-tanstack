import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	ScriptOnce,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { MotionConfig } from "motion/react";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { TooltipProvider } from "@/components/ui/tooltip-provider";
import { env } from "@/env";
import { currentViewer } from "@/lib/account";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance/boot-script";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import { cspHeaders } from "@/lib/security/csp";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return getToken();
});

// The Convex URLs are the ones built into the client, since those are what the browser connects to.
function pageCspHeaders(nonce: string | undefined): Record<string, string> {
	if (!nonce) return {};
	return cspHeaders({
		nonce,
		convexUrls: [env.VITE_CONVEX_URL, env.VITE_CONVEX_SITE_URL],
		dev: import.meta.env.DEV,
	});
}

interface MyRouterContext {
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "High Elo LLMs",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	beforeLoad: async (ctx) => {
		// In the browser this runs on every navigation, and a server function would be a round trip to
		// our server each time (quality audit P9). Better Auth's session store already knows whether
		// someone is signed in. The token only matters on the server (SSR queries and the provider's
		// first render, which hydration carries over).
		if (!import.meta.env.SSR) {
			const viewer = await currentViewer();
			return { isAuthenticated: viewer !== null, token: undefined };
		}

		const token = await getAuth();

		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		return {
			isAuthenticated: !!token,
			token,
		};
	},

	// Every page carries the CSP for its nonce (src/lib/security/csp.ts). Keep this after `beforeLoad`:
	// TypeScript infers the route context in key order, and placed earlier it loses `beforeLoad`'s.
	headers: ({ ssr }) => pageCspHeaders(ssr?.nonce),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const context = useRouteContext({ from: Route.id });

	return (
		<ConvexBetterAuthProvider
			client={context.convexQueryClient.convexClient}
			// @convex-dev/better-auth 0.12's `AuthClient` type collapses `useSession().data`
			// to `never` on better-auth >=1.6.16, so no real client satisfies it. Runtime is
			// fine. Remove this once the adapter fixes the type (tsc flags it as unused).
			// @ts-expect-error -- upstream type bug, see above
			authClient={authClient}
			initialToken={context.token}
		>
			{/* The appearance script below sets <html>'s class and style before hydration. */}
			<html lang="en" suppressHydrationWarning>
				<head>
					{/* Appearance settings before first paint, so the default theme never flashes (roadmap
					    3.11). Server-only, carries the CSP nonce, and removes itself before hydration. */}
					<ScriptOnce>{APPEARANCE_BOOT_SCRIPT}</ScriptOnce>
					<HeadContent />
				</head>
				<body>
					{/* Hard rule 3: with "Reduce motion" on, Motion makes position, size and layout animations
					    instant (the composer resizes without animating). Opacity fades still play. */}
					<AppearanceSync />
					<MotionConfig reducedMotion="user">
						{/* Base UI tooltips share their open delay through one provider (0 ms, as before). */}
						<TooltipProvider>{children}</TooltipProvider>
					</MotionConfig>
					{/* Page views and Web Vitals in production, unless switched off (roadmap 1.8). */}
					<VercelAnalytics />
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
					<Scripts />
				</body>
			</html>
		</ConvexBetterAuthProvider>
	);
}
