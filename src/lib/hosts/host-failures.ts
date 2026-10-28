import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import type { HostHealth } from "./endpoint-stats";

// This browser's own recent failures per host (roadmap 2.2b), so a host that keeps answering 429 or
// 5xx here shows orange or red even when the public status says it's fine. Kept in localStorage: a
// host key ("fireworks", "openrouter:deepinfra/fp8"), HTTP statuses and times. Nothing else.

export const HOST_FAILURES_KEY = "highelo-host-failures";

/** Failures older than this are forgotten. */
const WINDOW_MS = 15 * 60 * 1000;
/** This many recent failures, or one auth failure, make a host red. */
const DOWN_AFTER = 3;
const MAX_HOSTS = 50;
const MAX_PER_HOST = 10;

const failureSchema = z.object({
	at: z.number().int().nonnegative(),
	status: z.number().int().min(0).max(999).optional(),
});
type Failure = z.infer<typeof failureSchema>;
type Failures = Record<string, Failure[]>;

const failures = createLocalStore<Failures>(
	HOST_FAILURES_KEY,
	z.record(z.string().max(120), z.array(failureSchema).max(MAX_PER_HOST)),
	{},
);

/** The key a host is recorded under: the connection, plus the pinned upstream on a router. */
export function hostKey(provider: string, upstream?: string): string {
	return upstream ? `${provider}:${upstream}` : provider;
}

function recent(list: readonly Failure[] | undefined, now: number) {
	return (list ?? []).filter((failure) => now - failure.at < WINDOW_MS);
}

function prune(all: Failures, now: number): Failures {
	const entries = Object.entries(all)
		.map(([key, list]) => [key, recent(list, now)] as const)
		.filter(([, list]) => list.length > 0)
		.slice(-MAX_HOSTS);
	return Object.fromEntries(entries);
}

/** Records how a request to a host went. A success clears its failures. */
export function recordHostResult(
	key: string,
	result: { ok: true } | { ok: false; status?: number },
	now = Date.now(),
): void {
	const all = prune(failures.read(), now);
	if (result.ok) {
		if (!(key in all)) return;
		const { [key]: _cleared, ...rest } = all;
		failures.write(rest);
		return;
	}
	const list = [...(all[key] ?? []), { at: now, status: result.status }];
	failures.write({ ...all, [key]: list.slice(-MAX_PER_HOST) });
}

/** How this browser's recent requests to a host went: "up" when nothing failed lately. */
export function localHealth(
	all: Failures,
	key: string,
	now = Date.now(),
): HostHealth {
	const list = recent(all[key], now);
	if (list.length === 0) return "up";
	const authFailed = list.some(
		(failure) => failure.status === 401 || failure.status === 403,
	);
	return authFailed || list.length >= DOWN_AFTER ? "down" : "slow";
}

/** Every recorded failure, for `localHealth`. Re-renders when one is recorded. */
export function useHostFailures(): Failures {
	return failures.use();
}

export function readHostFailures(): Failures {
	return failures.read();
}
