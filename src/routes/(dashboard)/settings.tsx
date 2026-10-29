import { createFileRoute } from "@tanstack/react-router";
import { LocalEndpoints } from "@/components/settings/local-endpoints";
import { ProviderKeys } from "@/components/settings/provider-keys";

// Settings → API keys and local model servers. Client-only (decision 12): keys live in this browser,
// and with no server render there's no key form a pre-hydration submit could send. Also OpenRouter's
// OAuth callback page.
export const Route = createFileRoute("/(dashboard)/settings")({
	ssr: false,
	component: SettingsPage,
});

function SettingsPage() {
	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto grid max-w-3xl gap-10 px-6 py-10">
				<ProviderKeys />
				<LocalEndpoints />
			</div>
		</div>
	);
}
