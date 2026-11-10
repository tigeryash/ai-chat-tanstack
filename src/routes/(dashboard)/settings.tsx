import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ChatPlaceholder } from "@/components/chat/chat-placeholder";
import { completeOpenRouterCallback } from "@/lib/keys/openrouter-callback";
import {
	type SettingsSectionId,
	sectionForLegacySettingsLink,
} from "@/lib/settings/sections";

// Settings is a dialog on any page now (`?settings=<section>`, roadmap R2 S1). This route keeps old
// `/settings` links working by redirecting into it, and stays OpenRouter's OAuth callback: with
// `?code=` it finishes the connection here, then opens Settings → Connections. Client-only (decision
// 12): the exchange and the key vault are in the browser, and the decision reads the real address bar
// in the component rather than in `beforeLoad`, so nothing about it runs on the server.
export const Route = createFileRoute("/(dashboard)/settings")({
	ssr: false,
	component: SettingsRedirect,
});

/** Finishes an OpenRouter callback if this is one, then says which section to open. */
async function landingSection(): Promise<SettingsSectionId> {
	const hash = window.location.hash;
	return (await completeOpenRouterCallback())
		? "connections"
		: sectionForLegacySettingsLink(hash);
}

function SettingsRedirect() {
	const navigate = useNavigate();
	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void landingSection().then((settings) =>
			navigate({ to: "/new", search: { settings }, replace: true }),
		);
	}, [navigate]);

	return <ChatPlaceholder>Opening Settings…</ChatPlaceholder>;
}
