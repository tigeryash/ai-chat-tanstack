import { Chat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { ContextWarning } from "@/components/chat/context-warning";
import {
	CONTEXT_FIXTURE_CHATS,
	CONTEXT_FIXTURE_LENGTH,
} from "@/lib/chat/context-usage.fixtures";

export const Route = createFileRoute("/e2e/context-warning")({
	component: ContextWarningHarness,
});

const LEVELS = ["under", "nearing", "over"] as const;
const chatFor = (level: (typeof LEVELS)[number]) =>
	new Chat<UIMessage>({
		id: `context-${level}`,
		messages: CONTEXT_FIXTURE_CHATS[level],
	});
const CHATS = {
	under: chatFor("under"),
	nearing: chatFor("nearing"),
	over: chatFor("over"),
};

// Context-length warnings (roadmap R2 S4, e2e/context-warning.spec.ts): the notice under a pane-like
// header for chats under, near and past a 128K context. `data-hydrated` tells tests when the client
// has taken over.
function ContextWarningHarness() {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	return (
		<main
			data-hydrated={hydrated}
			className="grid min-h-screen gap-4 bg-background p-4 md:grid-cols-3"
		>
			{LEVELS.map((level) => (
				<section
					key={level}
					aria-label={`Chat ${level}`}
					className="rounded-pane border bg-card"
				>
					<div className="flex w-full shrink-0 flex-col border-b">
						<div className="px-3 py-2 font-mono text-muted-foreground text-xs">
							DeepSeek V4.1 Flash
						</div>
						<ContextWarning
							chat={CHATS[level]}
							contextLength={CONTEXT_FIXTURE_LENGTH}
						/>
					</div>
				</section>
			))}
		</main>
	);
}
