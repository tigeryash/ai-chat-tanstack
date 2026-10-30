import { track as vercelTrack } from "@vercel/analytics";
import { logWarn } from "@/lib/log";
import { redact } from "@/lib/redact";
import { analyticsAllowed } from "./consent";
import {
	EVENT_SCHEMAS,
	type EventName,
	type EventProperties,
	isEventName,
	type SafeProperties,
} from "./events";

// `track()` is the only way the app sends an analytics event (hard rule 4, decision 23). An event goes
// out only if analytics are allowed in this browser (consent.ts), its name is on the allowlist
// (events.ts), and its properties pass that event's schema; unknown properties are dropped. `redact()`
// runs last as a second guard: if it would change anything, the whole event is dropped.
//
// Where events go: in `bun run dev` and VITE_E2E builds, nowhere; they're recorded in memory for tests.
// In production they go to Vercel Web Analytics, but only with VITE_ANALYTICS_CUSTOM_EVENTS=true: custom
// events need Vercel Pro, and on Hobby they'd be dropped anyway. Page views don't go through here.

export interface TrackedEvent {
	name: EventName;
	properties: SafeProperties;
}

export type AnalyticsSink = (event: TrackedEvent) => void;

/** Checks an event against the allowlist. Returns what may be sent, or null to drop it. */
export function sanitizeEvent(
	name: string,
	properties: unknown,
): TrackedEvent | null {
	if (!isEventName(name)) return null;
	const parsed = EVENT_SCHEMAS[name].safeParse(properties ?? {});
	if (!parsed.success) return null;
	const kept: SafeProperties = Object.fromEntries(
		Object.entries(parsed.data).filter(([, value]) => value !== undefined),
	);
	const scrubbed = redact(kept);
	if (JSON.stringify(scrubbed) !== JSON.stringify(kept)) return null;
	return { name, properties: kept };
}

export function createTracker(options: {
	allowed: () => boolean;
	sink: AnalyticsSink;
}) {
	return function track<Name extends EventName>(
		name: Name,
		properties: EventProperties<Name>,
	): void {
		try {
			if (!options.allowed()) return;
			const event = sanitizeEvent(name, properties);
			if (!event) {
				logWarn("Analytics event dropped:", name);
				return;
			}
			options.sink(event);
		} catch (error) {
			// Analytics must never break the feature that reports to it.
			logWarn("Analytics event failed:", error);
		}
	};
}

// The build flags are read here when an event is sent, not through `@/env`: the key vault imports this
// module, e2e specs import the vault's provider list in Node, and `@/env` throws there at import time
// (no Convex URLs). `src/env.ts` still validates both flags in the app.

/** "record" keeps events in memory (dev, e2e, tests); "vercel" is a production build. */
export function analyticsMode(): "record" | "vercel" {
	return import.meta.env.DEV || import.meta.env.VITE_E2E === "true"
		? "record"
		: "vercel";
}

const recorded: TrackedEvent[] = [];

declare global {
	interface Window {
		/** The events `track()` recorded, in dev and e2e builds only (e2e/analytics.spec.ts reads it). */
		__highEloAnalytics?: TrackedEvent[];
	}
}

/** What `track()` recorded in this page so far (record mode only). */
export function recordedEvents(): readonly TrackedEvent[] {
	return recorded;
}

export function clearRecordedEvents(): void {
	recorded.length = 0;
}

function defaultSink(event: TrackedEvent): void {
	if (analyticsMode() === "record") {
		recorded.push(event);
		if (typeof window !== "undefined") window.__highEloAnalytics = recorded;
		return;
	}
	if (import.meta.env.VITE_ANALYTICS_CUSTOM_EVENTS === "true") {
		vercelTrack(event.name, event.properties);
	}
}

export const track = createTracker({
	allowed: analyticsAllowed,
	sink: defaultSink,
});
