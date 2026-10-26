import { createFileRoute } from "@tanstack/react-router";
import { ProviderKeys } from "@/components/settings/provider-keys";

// The API key settings without the signed-in dashboard around them (e2e/keys.spec.ts). Also the
// OpenRouter callback page in tests.
export const Route = createFileRoute("/e2e/keys")({
	ssr: false,
	component: KeysHarness,
});

function KeysHarness() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<ProviderKeys />
		</main>
	);
}
