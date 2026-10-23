import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/chat/input";

export const Route = createFileRoute("/e2e/composer")({
	component: ComposerHarness,
});

// The composer as it sits on /new, minus the signed-in dashboard around it. Submitted text is echoed
// below so tests can check submit behavior; `data-hydrated` tells them when typing is safe.
function ComposerHarness() {
	const [hydrated, setHydrated] = useState(false);
	const [submitted, setSubmitted] = useState<string[]>([]);

	useEffect(() => {
		setHydrated(true);
	}, []);

	return (
		<main
			data-hydrated={hydrated}
			className="flex h-screen flex-col items-center justify-center space-y-8"
		>
			<Input
				onSubmit={async (message) => {
					setSubmitted((previous) => [...previous, message]);
				}}
			/>
			<ol aria-label="Submitted messages" className="text-sm text-black/60">
				{submitted.map((message, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: append-only test log
					<li key={index}>{message}</li>
				))}
			</ol>
		</main>
	);
}
