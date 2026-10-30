import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";
import terms from "../../docs/legal/terms.md?raw";

// Server-rendered and signed-out, like /privacy.
export const Route = createFileRoute("/terms")({
	head: () => ({ meta: [{ title: "Terms of Service · High Elo LLMs" }] }),
	component: () => <LegalPage markdown={terms} />,
});
