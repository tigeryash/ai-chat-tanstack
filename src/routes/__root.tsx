import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return getToken();
});

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
		const token = await getAuth();

		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		return {
			isAuthenticated: !!token,
			token,
		};
	},

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
			<html lang="en">
				<head>
					<HeadContent />
				</head>
				<body>
					{/* Hard rule 3: with "Reduce motion" on, Motion makes position, size and layout animations
					    instant (the composer resizes without animating). Opacity fades still play. */}
					<MotionConfig reducedMotion="user">
						{/* Base UI tooltips share their open delay through one provider (0 ms, as before). */}
						<TooltipProvider>{children}</TooltipProvider>
					</MotionConfig>
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
