import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { HUGE_PAYLOADS, XSS_PAYLOADS } from "./-xss-payloads";

type Search = { huge?: boolean };

export const Route = createFileRoute("/e2e/markdown")({
	validateSearch: (search: Record<string, unknown>): Search => ({
		huge: search.huge === true || search.huge === "true" ? true : undefined,
	}),
	component: MarkdownHarness,
});

// Hostile model output rendered the way a chat shows it: each payload as an assistant reply and as
// open reasoning. `?huge=true` renders the oversized payloads instead. `data-hydrated` tells tests
// when the client has taken over.
function MarkdownHarness() {
	const { huge } = Route.useSearch();
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setHydrated(true);
	}, []);

	const payloads = huge ? HUGE_PAYLOADS : XSS_PAYLOADS;

	return (
		<main data-hydrated={hydrated} className="mx-auto max-w-3xl space-y-8 p-8">
			{payloads.map((payload) => (
				<section
					key={payload.name}
					aria-label={payload.name}
					data-payload={payload.name}
					className="space-y-2"
				>
					<h2 className="font-semibold text-sm">{payload.name}</h2>
					<Message from="assistant" data-testid="reply">
						<MessageContent>
							<MessageResponse>{payload.markdown}</MessageResponse>
						</MessageContent>
					</Message>
					<Reasoning defaultOpen data-testid="reasoning">
						<ReasoningTrigger />
						<ReasoningContent>{payload.markdown}</ReasoningContent>
					</Reasoning>
				</section>
			))}
		</main>
	);
}
