import { createFileRoute } from "@tanstack/react-router";
import { DesignShell } from "./-shared/design-shell";
import { designSearch } from "./-shared/search";
import "./-shared/base.css";
import "./-shared/minimal.css";

// Direction A (roadmap 3.0): minimal dark, close to the Vercel AI SDK playground.
export const Route = createFileRoute("/e2e/design/minimal")({
	ssr: false,
	validateSearch: designSearch,
	component: MinimalDirection,
});

function MinimalDirection() {
	const { theme = "dark" } = Route.useSearch();
	return <DesignShell direction="minimal" theme={theme} />;
}
