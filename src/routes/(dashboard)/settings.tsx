import { createFileRoute } from "@tanstack/react-router";
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
		<div className="h-full overflow-y-auto">
			<div className="mx-auto max-w-3xl px-6 py-10">
				<ProviderKeys />
				<LocalEndpoints />
				<BackgroundStatusSettings />
			</div>
		</div>
	);
}
