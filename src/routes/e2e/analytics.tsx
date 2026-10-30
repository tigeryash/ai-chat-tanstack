import { createFileRoute } from "@tanstack/react-router";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";
import { AnalyticsSettings } from "@/components/settings/analytics-settings";

// Loads Vercel Web Analytics and Speed Insights the way production does (dev and e2e builds skip them),
// next to the Settings switch, so e2e/analytics.spec.ts can check them against the CSP and the opt-out.
export const Route = createFileRoute("/e2e/analytics")({
	ssr: false,
	component: AnalyticsHarness,
});

function AnalyticsHarness() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<VercelAnalytics force />
			<AnalyticsSettings />
		</main>
	);
}
