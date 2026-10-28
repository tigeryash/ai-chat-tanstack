import { createFileRoute } from "@tanstack/react-router";
import { DesignShell } from "./-shared/design-shell";
import { designSearch } from "./-shared/search";
import "./-shared/base.css";
import "./-shared/editorial.css";

// Direction C (roadmap 3.0): light and editorial, replies set in a serif.
export const Route = createFileRoute("/e2e/design/editorial")({
	ssr: false,
	validateSearch: designSearch,
	component: EditorialDirection,
});

function EditorialDirection() {
	const { theme = "light" } = Route.useSearch();
	return <DesignShell direction="editorial" theme={theme} />;
}
