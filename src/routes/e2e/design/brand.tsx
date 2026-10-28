import { CatchBoundary, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { logError } from "@/lib/log";
import { DesignShell } from "./-shared/design-shell";
import { designSearch } from "./-shared/search";
import "./-shared/base.css";
import "./-shared/brand.css";

// Direction B (roadmap 3.0): the landing page's palette and shader carried into the app.

// The landing page's shader, as the sidebar's brand card. It already draws one still frame under
// reduced motion (hard rule 3).
const Scene = lazy(() => import("@/components/background/scene"));

export const Route = createFileRoute("/e2e/design/brand")({
	ssr: false,
	validateSearch: designSearch,
	component: BrandDirection,
});

function BrandDirection() {
	const { theme = "dark" } = Route.useSearch();
	return (
		<DesignShell
			direction="brand"
			theme={theme}
			brandCard={<ShaderCard />}
			backdrop={
				<div className="design-glow" aria-hidden>
					<span />
					<span />
					<span />
				</div>
			}
		/>
	);
}

function ShaderCard() {
	return (
		<div className="relative h-32 overflow-hidden rounded-xl bg-slate-900 [&>div]:inset-0! [&>div]:rounded-none!">
			{/* Decoration: if WebGL is missing, the card stays plain slate. */}
			<CatchBoundary
				getResetKey={() => "scene"}
				errorComponent={() => null}
				onCatch={(error) => logError("Brand card scene failed", error)}
			>
				<Suspense fallback={null}>
					<Scene />
				</Suspense>
			</CatchBoundary>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/70 to-transparent px-3 pt-6 pb-2.5">
				<div className="font-extrabold text-lg text-white leading-none tracking-tight">
					High ELO LLMs
				</div>
				<div className="mt-1 text-[0.6875rem] text-white/70">
					Your keys. Your models. Side by side.
				</div>
			</div>
		</div>
	);
}
