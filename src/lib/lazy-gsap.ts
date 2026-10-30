import type { gsap as Gsap } from "gsap";
import type { SplitText as SplitTextPlugin } from "gsap/SplitText";
import { type RefObject, useEffect } from "react";
import { logError } from "@/lib/log";

// GSAP for the auth pages' reveals, loaded with `import()` so it isn't in any route's preloads (quality audit
// P2). The auth layout calls `loadGsap()` as its module loads, so the download runs alongside hydration and is
// usually done before the first reveal needs it. Only the SplitText plugin is loaded, not `gsap/all`.

export interface GsapKit {
	gsap: typeof Gsap;
	SplitText: typeof SplitTextPlugin;
}

let loading: Promise<GsapKit> | undefined;

export function loadGsap(): Promise<GsapKit> {
	loading ??= Promise.all([import("gsap"), import("gsap/SplitText")]).then(
		([{ gsap }, { SplitText }]) => {
			gsap.registerPlugin(SplitText);
			return { gsap, SplitText };
		},
		(error: unknown) => {
			// Let a later page try again.
			loading = undefined;
			throw error;
		},
	);
	return loading;
}

/**
 * Runs `setup` once on mount, after GSAP loads, inside a `gsap.context` scoped to `scope` (like `useGSAP`
 * with no dependencies). Everything it creates is reverted on unmount. Put animations inside
 * `gsap.matchMedia().add(FULL_MOTION, ...)` so they never start with reduced motion (hard rule 3).
 * If GSAP can't load, the page simply doesn't animate. Like `useGSAP` with `dependencies: []`, it runs
 * once on mount: `setup` and `scope` aren't dependencies.
 */
export function useLazyGsap(
	setup: (kit: GsapKit) => void,
	scope: RefObject<Element | null>,
): void {
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount, like useGSAP's `dependencies: []`.
	useEffect(() => {
		let cancelled = false;
		let context: ReturnType<typeof Gsap.context> | undefined;
		loadGsap().then(
			(kit) => {
				if (cancelled) return;
				context = kit.gsap.context(
					() => setup(kit),
					scope.current ?? undefined,
				);
			},
			(error: unknown) => logError("Couldn't load the page animations:", error),
		);
		return () => {
			cancelled = true;
			context?.revert();
		};
	}, []);
}
