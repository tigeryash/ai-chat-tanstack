import { PROVIDER_IDS } from "@/lib/keys/providers";
import { ProviderKeyRow } from "./provider-key-row";
import { useProviderKeys } from "./use-provider-keys";

/**
 * Settings → Connections → API keys (roadmap 1.1). Add, test and delete a key per provider. Rendered
 * client-side only (the Settings dialog, `/e2e/keys`), so no key form exists before hydration.
 */
export function ProviderKeyList() {
	const { keys, loadError, save, remove } = useProviderKeys();
	const byProvider = new Map(
		keys?.map((summary) => [summary.providerId, summary]),
	);

	return (
		<div className="grid">
			{loadError && (
				<p role="alert" className="text-sm text-destructive">
					{loadError}
				</p>
			)}
			{keys === null ? (
				<p className="py-4 text-sm text-muted-foreground">
					Loading saved keys…
				</p>
			) : (
				PROVIDER_IDS.map((providerId) => (
					<ProviderKeyRow
						key={providerId}
						providerId={providerId}
						saved={byProvider.get(providerId)}
						onSave={save}
						onDelete={remove}
					/>
				))
			)}
		</div>
	);
}
