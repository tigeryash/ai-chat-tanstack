import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

export const Route = createFileRoute("/e2e/loading")({
	component: LoadingHarness,
});

// The loading indicators that normally sit behind sign-in: reasoning while it streams (its "Thinking..."
// title shimmers) and once it is done, and the
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
			<div className="w-80">
				<Reasoning isStreaming>
					<ReasoningTrigger />
					<ReasoningContent>
						Checking which models fit the request.
					</ReasoningContent>
				</Reasoning>
				<Reasoning defaultOpen={false} duration={3}>
					<ReasoningTrigger />
					<ReasoningContent>Done thinking.</ReasoningContent>
				</Reasoning>
			</div>
			<Loader2 className="w-5 h-5 animate-spin text-black/50" />
		</main>
	);
}
