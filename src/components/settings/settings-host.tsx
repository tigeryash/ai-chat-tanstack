import { ClientOnly, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import {
	forgetSettingsPush,
	useSettingsNavigation,
} from "@/lib/settings/navigation";

// The Settings dialog loads on first open: its controls stay out of every page's first load (bundle
// budget). Only this host, the `?settings=` parser and the Cmd+, listener are on every page.
const SettingsDialog = lazy(() =>
	import("./settings-dialog").then((module) => ({
		default: module.SettingsDialog,
	})),
);

/** Opens Settings when the URL has `?settings=<section>` on any page, and on Cmd+, (Ctrl+, elsewhere). */
export function SettingsHost() {
	return (
		<ClientOnly>
			<SettingsDialogHost />
		</ClientOnly>
	);
}

function isSettingsShortcut(event: KeyboardEvent): boolean {
	return (
		event.key === "," &&
		(event.metaKey || event.ctrlKey) &&
		!event.altKey &&
		!event.shiftKey &&
		!event.repeat
	);
}

function SettingsDialogHost() {
	const section = useSearch({
		strict: false,
		select: (search) => search.settings,
	});
	const navigation = useSettingsNavigation();
	// Stays mounted after the first open, so closing plays its exit and returns focus.
	const [loaded, setLoaded] = useState(false);
	if (section && !loaded) setLoaded(true);

	const open = navigation.open;
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!isSettingsShortcut(event)) return;
			event.preventDefault();
			if (!section) open();
		};
		// Capture, so a field that handles its own keys (the composer) can't swallow the shortcut.
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, [section, open]);

	useEffect(() => {
		if (!section) forgetSettingsPush();
	}, [section]);

	if (!loaded) return null;
	return (
		<Suspense fallback={null}>
			<SettingsDialog
				section={section}
				onSelect={navigation.select}
				onClose={navigation.close}
			/>
		</Suspense>
	);
}
