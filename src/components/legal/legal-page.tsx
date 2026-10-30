import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { ExtraProps } from "streamdown";
import { SafeMarkdown } from "@/components/ai-elements/safe-markdown";

// The privacy policy and terms (roadmap 7.1), rendered from docs/legal/*.md so the drafts and the
// pages never drift. The text is ours, but SafeMarkdown is the one markdown renderer the app uses.
// Its links open in a new tab and relative ones are dropped, so the drafts link to each other only
// through the nav below.
export function LegalPage({ markdown }: { markdown: string }) {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-3xl px-6 py-10">
				<nav
					aria-label="Legal"
					className="mb-8 flex gap-4 text-muted-foreground text-sm"
				>
					<Link to="/new" className="hover:text-foreground">
						High Elo LLMs
					</Link>
					<Link
						to="/privacy"
						className="hover:text-foreground"
						activeProps={{ className: "text-foreground" }}
					>
						Privacy
					</Link>
					<Link
						to="/terms"
						className="hover:text-foreground"
						activeProps={{ className: "text-foreground" }}
					>
						Terms
					</Link>
				</nav>
				<article>
					<SafeMarkdown
						mode="static"
						parseIncompleteMarkdown={false}
						components={{ h1: Title }}
					>
						{markdown}
					</SafeMarkdown>
				</article>
			</div>
		</main>
	);
}

// Streamdown's own h1 is smaller than its h2; the page title should lead.
function Title({ children }: ComponentProps<"h1"> & ExtraProps) {
	return <h1 className="mb-6 font-semibold text-3xl">{children}</h1>;
}
