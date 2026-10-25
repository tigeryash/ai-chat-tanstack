import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/e2e/loading")({
	component: LoadingHarness,
});

// The loading indicators that normally sit behind sign-in: the reasoning "Thinking..." shimmer and the
// spinner the composer shows while it compresses an upload. `data-hydrated` tells tests when the
// client has taken over.
function LoadingHarness() {
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setHydrated(true);
	}, []);

	return (
		<main
			data-hydrated={hydrated}
			className="flex h-screen flex-col items-center justify-center space-y-8"
		>
			<Shimmer duration={1}>Thinking...</Shimmer>
			<Loader2 className="w-5 h-5 animate-spin text-black/50" />
		</main>
	);
}
