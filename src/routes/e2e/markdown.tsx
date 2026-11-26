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

type Search = { huge?: boolean; code?: boolean };

/** `?code=true`: one fenced block, for code highlighting (roadmap R2 S9, theme-presets.spec.ts). */
const CODE_SAMPLE =
	"```ts\nconst answer: number = 42;\nexport function hello() {\n  return answer;\n}\n```";

// Client-only, like every route that shows chats (roadmap 1.2). Server-rendered, the page streamed
// finished markdown that React then swapped back to SafeMarkdown's loading fallback until the lazy
// Streamdown chunk arrived, so a test could see the server's links, then none (xss.spec.ts flake).
export const Route = createFileRoute("/e2e/markdown")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): Search => ({
		huge: search.huge === true || search.huge === "true" ? true : undefined,
		code: search.code === true || search.code === "true" ? true : undefined,
	}),
	component: MarkdownHarness,
});

// Hostile model output rendered the way a chat shows it: each payload as an assistant reply and as
// open reasoning. `?huge=true` renders the oversized payloads instead. `data-hydrated` tells tests
// when the client has taken over.
function MarkdownHarness() {
	const { huge, code } = Route.useSearch();
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setHydrated(true);
	}, []);

	const payloads = huge ? HUGE_PAYLOADS : XSS_PAYLOADS;

	if (code) {
		return (
			<main data-hydrated={hydrated} className="mx-auto max-w-3xl p-8">
				<Message from="assistant" data-testid="reply">
					<MessageContent>
						<MessageResponse>{CODE_SAMPLE}</MessageResponse>
					</MessageContent>
				</Message>
			</main>
		);
	}

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
					<Reasoning open data-testid="reasoning">
						<ReasoningTrigger />
						<ReasoningContent>{payload.markdown}</ReasoningContent>
					</Reasoning>
				</section>
			))}
		</main>
	);
}
