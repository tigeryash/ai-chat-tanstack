import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { env } from "@/env";

// Test-only pages that render components without a session, for Playwright and for agents
// previewing UI. They exist in `bun run dev` and in builds made with VITE_E2E=true; anywhere else, 404.
export const Route = createFileRoute("/e2e")({
	beforeLoad: () => {
		if (!import.meta.env.DEV && env.VITE_E2E !== "true") {
			throw notFound();
		}
	},
	component: Outlet,
});
