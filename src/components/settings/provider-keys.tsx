import { PROVIDER_IDS } from "@/lib/keys/providers";
import { ConnectOpenRouter } from "./connect-openrouter";
import { ProviderKeyRow } from "./provider-key-row";
import { useProviderKeys } from "./use-provider-keys";

/**
 * Settings → API keys (roadmap 1.1). Add, test and delete a key per provider, or connect OpenRouter.
 * Must render on the page OpenRouter returns to. Render it client-side only (`ssr: false`), so no
 * key form exists before hydration.
 */
export function ProviderKeys() {
	const { keys, loadError, save, remove } = useProviderKeys();
	const byProvider = new Map(
		keys?.map((summary) => [summary.providerId, summary]),
	);

	return (
		<div className="grid gap-6">
			<header className="grid gap-2">
				<h1 className="text-2xl font-semibold">API keys</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">
					You pay providers directly with your own keys. A key stays in this
					browser and is only ever sent to its own provider, never to our
					server. Prefer keys with a spending limit.
				</p>
				{loadError && (
					<p role="alert" className="text-sm text-destructive">
						{loadError}
					</p>
				)}
			</header>

			<ConnectOpenRouter
				connected={byProvider.has("openrouter")}
				onConnected={(key, mode) =>
					save("openrouter", key, mode, "openrouter-oauth")
				}
			/>

			<section aria-labelledby="provider-keys" className="grid">
				<h2 id="provider-keys" className="font-semibold">
					Providers
				</h2>
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
			</section>
		</div>
	);
}
