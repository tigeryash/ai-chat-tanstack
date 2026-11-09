import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatUsageSummary } from "@/components/chat/chat-usage";
import MessagesList from "@/components/chat/chatstuff/messages-list";
import { chatUsage } from "@/lib/chat/chat-usage";
import { USAGE_FIXTURE_MESSAGES } from "@/lib/chat/usage.fixtures";

export const Route = createFileRoute("/e2e/usage")({
	component: UsageHarness,
});

const usage = chatUsage(USAGE_FIXTURE_MESSAGES);

// A saved chat's usage and cost (roadmap 2.5, e2e/usage.spec.ts): the header total and each reply's
// stats, from fixture metadata. `data-hydrated` tells tests when the client has taken over.
function UsageHarness() {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	return (
		<main data-hydrated={hydrated} className="flex h-screen flex-col">
			<div className="@container/header flex justify-end border-b px-3 py-2">
				{usage && <ChatUsageSummary usage={usage} />}
			</div>
			<MessagesList messages={USAGE_FIXTURE_MESSAGES} />
		</main>
	);
}
