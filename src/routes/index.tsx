import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({
				to: "/new",
			});
		} else {
			throw redirect({
				to: "/login",
			});
		}
	},
});
