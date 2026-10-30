import { createFileRoute, Link } from "@tanstack/react-router";
import { AnalyticsSettings } from "@/components/settings/analytics-settings";
import { BackgroundStatusSettings } from "@/components/settings/background-status-settings";
import { LocalEndpoints } from "@/components/settings/local-endpoints";
import { ProviderKeys } from "@/components/settings/provider-keys";

// Settings → API keys, local model servers and background status. Client-only (decision 12): keys
// live in this browser, and with no server render there's no key form a pre-hydration submit could
// send. Also OpenRouter's OAuth callback page.
export const Route = createFileRoute("/(dashboard)/settings")({
	ssr: false,
	component: SettingsPage,
});

function SettingsPage() {
	return (
		<div className="h-full overflow-y-auto rounded-pane border bg-card text-card-foreground">
			<div className="mx-auto max-w-3xl px-6 py-10">
				<ProviderKeys />
				<LocalEndpoints />
				<BackgroundStatusSettings />
				<AnalyticsSettings />
				<nav
					aria-label="Legal"
					className="mt-10 flex gap-4 text-muted-foreground text-sm"
				>
					<Link to="/privacy" className="hover:text-foreground">
						Privacy Policy
					</Link>
					<Link to="/terms" className="hover:text-foreground">
						Terms of Service
					</Link>
				</nav>
			</div>
		</div>
	);
}
