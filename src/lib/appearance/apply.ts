import { logWarn } from "@/lib/log";
import { REDUCED_MOTION } from "@/lib/reduced-motion";
import { BOOT_SNAPSHOT_KEY } from "./boot-script";
import type { AppearanceSettings } from "./schema";
import {
	type AppearanceSnapshot,
	appearanceSnapshot,
	MANAGED_VARS,
} from "./snapshot";

/** Puts a snapshot on `root` (normally <html>), replacing whatever the last one set. */
export function applySnapshot(
	snapshot: AppearanceSnapshot,
	root: HTMLElement,
): void {
	root.classList.remove("light", "dark");
	if (snapshot.scheme) root.classList.add(snapshot.scheme);
	for (const name of MANAGED_VARS) {
		const value = snapshot.vars[name];
		if (value === undefined) root.style.removeProperty(name);
		else root.style.setProperty(name, value);
	}
}

/**
 * Applies `settings` to the page and stores the snapshot the <head> script applies on the next load.
 * A theme change cross-fades with a view transition, unless the system asks for reduced motion.
 */
export function applyAppearance(
	settings: AppearanceSettings,
	root: HTMLElement = document.documentElement,
): void {
	const snapshot = appearanceSnapshot(settings);
	const schemeChanged =
		currentScheme(root) !== snapshot.scheme &&
		root.ownerDocument.visibilityState === "visible";
	const apply = () => applySnapshot(snapshot, root);
	const doc = root.ownerDocument;
	if (
		schemeChanged &&
		typeof doc.startViewTransition === "function" &&
		!doc.defaultView?.matchMedia(REDUCED_MOTION).matches
	) {
		doc.startViewTransition(apply);
	} else {
		apply();
	}
	saveBootSnapshot(snapshot);
}

function currentScheme(root: HTMLElement): AppearanceSnapshot["scheme"] {
	if (root.classList.contains("dark")) return "dark";
	if (root.classList.contains("light")) return "light";
	return null;
}

function saveBootSnapshot(snapshot: AppearanceSnapshot): void {
	try {
		localStorage.setItem(
			BOOT_SNAPSHOT_KEY,
			JSON.stringify({ v: 1, ...snapshot }),
		);
	} catch (error) {
		logWarn("Couldn't save the appearance for the next load:", error);
	}
}
