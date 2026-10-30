import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";
import privacyPolicy from "../../docs/legal/privacy-policy.md?raw";

// Server-rendered and signed-out (Google's OAuth consent screen links here).
export const Route = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy Policy · High Elo LLMs" }] }),
	component: () => <LegalPage markdown={privacyPolicy} />,
});
