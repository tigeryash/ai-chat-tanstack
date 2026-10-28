import { createFileRoute, Link } from "@tanstack/react-router";
import { DIRECTIONS } from "./-shared/design-shell";

// Roadmap 3.0: the design-direction prototypes, one page each. See docs/design-directions.md.
export const Route = createFileRoute("/e2e/design/")({
	component: DesignIndex,
});

function DesignIndex() {
	return (
		<main className="mx-auto max-w-xl space-y-4 p-10">
			<h1 className="font-semibold text-2xl">Design directions</h1>
			<ul className="space-y-2">
				{DIRECTIONS.map((item) => (
					<li key={item.id}>
						<Link to={`/e2e/design/${item.id}`} className="underline">
							{item.letter}. {item.label}
						</Link>
					</li>
				))}
			</ul>
		</main>
	);
}
