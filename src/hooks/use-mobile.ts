import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
	const mql = window.matchMedia(QUERY);
	mql.addEventListener("change", onChange);
	return () => mql.removeEventListener("change", onChange);
}

const isMobileNow = () => window.matchMedia(QUERY).matches;
// Only the server renders before the media query can be read; the routes that use this don't render there.
const isMobileOnServer = () => false;

/**
 * Whether the viewport is phone-sized. Read from `matchMedia` during the first render (not in an effect), so a
 * workspace on a phone mounts its panes once, in tabs, instead of in the desktop row first (quality audit Q2 W5).
 */
export function useIsMobile() {
	return useSyncExternalStore(subscribe, isMobileNow, isMobileOnServer);
}
