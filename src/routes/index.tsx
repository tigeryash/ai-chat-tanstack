import { createFileRoute, redirect } from "@tanstack/react-router";

// No login wall (decision 4): everyone starts on a new chat.
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/new" });
	},
});
