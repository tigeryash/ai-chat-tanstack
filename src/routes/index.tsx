import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (context.userId) {
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
