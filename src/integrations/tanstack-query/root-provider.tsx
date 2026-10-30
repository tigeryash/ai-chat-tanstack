import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { env } from "@/env";

export function getContext() {
	const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL, {
		expectAuth: true,
	});

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
			},
		},
	});
	convexQueryClient.connect(queryClient);

	return {
		queryClient,
		convexClient: convexQueryClient.convexClient,
		convexQueryClient,
	};
}
