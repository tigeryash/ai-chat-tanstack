import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ConnectOpenRouter } from "@/components/settings/connect-openrouter";
import { ProviderKeyList } from "@/components/settings/provider-keys";
import { completeOpenRouterCallback } from "@/lib/keys/openrouter-callback";

// The API key settings without the Settings dialog around them (e2e/keys.spec.ts). Also the OpenRouter
// callback page in tests: it finishes a callback here instead of on `/settings`.
export const Route = createFileRoute("/e2e/keys")({
	ssr: false,
	component: KeysHarness,
});

const CALLBACK_PATH = "/e2e/keys";

function KeysHarness() {
	const [ready, setReady] = useState(false);
	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void completeOpenRouterCallback().then(() => setReady(true));
	}, []);

	return (
		<main className="mx-auto grid max-w-3xl gap-6 px-6 py-10">
			{ready ? (
				<>
					<ConnectOpenRouter callbackPath={CALLBACK_PATH} />
					<ProviderKeyList />
				</>
			) : (
				<p>Finishing the OpenRouter connection…</p>
			)}
		</main>
	);
}
