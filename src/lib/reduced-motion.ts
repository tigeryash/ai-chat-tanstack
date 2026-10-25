import { useSyncExternalStore } from "react";

// The OS "Reduce motion" setting (decision 22). Motion reads it through `<MotionConfig reducedMotion="user">`
// in `__root.tsx`. GSAP reveals run inside `gsap.matchMedia().add(FULL_MOTION, ...)`, so with reduced motion
// they never start and their targets simply render at rest.
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const FULL_MOTION = "(prefers-reduced-motion: no-preference)";

function subscribe(onChange: () => void) {
	const query = window.matchMedia(REDUCED_MOTION);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(REDUCED_MOTION).matches;

// The server can't know the setting, so SSR and hydration assume full motion and the real value
// arrives right after hydration. That keeps markup matching. Updates live when the setting changes.
const getServerSnapshot = () => false;

export function usePrefersReducedMotion() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
