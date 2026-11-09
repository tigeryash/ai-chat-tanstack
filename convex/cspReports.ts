import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import {
	httpAction,
	internalMutation,
	internalQuery,
} from "./_generated/server";

// CSP violation counts (quality audit G1). Vercel Hobby keeps logs for an hour, so `/api/csp-report`
// also forwards each violation here, already cut down to directive, blocked origin and route pattern.
// One row per distinct (disposition, directive, blocked origin, page) with a count: no IPs, user
// agents, user ids or report bodies. Only our server can write, through the `/csp-report` HTTP action
// with the CSP_REPORT_SECRET shared secret; there is no public function. Read the results with
//   bunx convex run --prod cspReports:list

export const CSP_REPORT_SECRET_ENV = "CSP_REPORT_SECRET";
export const MAX_ROWS = 500;
export const MAX_COUNT_PER_KEY = 1_000_000;
export const MAX_VIOLATIONS_PER_REQUEST = 20;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 200;
const MAX_BODY_BYTES = 16 * 1024;

const violationValidator = v.object({
	disposition: v.union(v.literal("enforce"), v.literal("report")),
	directive: v.string(),
	blockedOrigin: v.string(),
	page: v.string(),
});

type Violation = typeof violationValidator.type;

/** Whether a violation has only the reduced shapes `/api/csp-report` sends; anything else is dropped. */
export function isReducedViolation(violation: Violation): boolean {
	return (
		/^[a-z-]{1,64}$/.test(violation.directive) &&
		isOriginOrKeyword(violation.blockedOrigin) &&
		/^\/[A-Za-z0-9\-[\]/]{0,63}$/.test(violation.page)
	);
}

function isOriginOrKeyword(value: string): boolean {
	if (value.length > 200) return false;
	// Keywords (`inline`, `eval`, `unknown`) and bare schemes (`data:`, `blob:`).
	if (/^[a-z-]+:?$/i.test(value)) return true;
	try {
		return new URL(value).origin === value;
	} catch {
		return false;
	}
}

export const record = internalMutation({
	args: { violations: v.array(violationValidator), now: v.number() },
	handler: async (ctx, { violations, now }) => {
		let stored = 0;
		for (const violation of violations.slice(0, MAX_VIOLATIONS_PER_REQUEST)) {
			if (!isReducedViolation(violation)) continue;
			if (await upsert(ctx, violation, now)) stored += 1;
		}
		return { stored };
	},
});

/** Adds one to the violation's row, or makes the row while the table is under MAX_ROWS. */
async function upsert(
	ctx: MutationCtx,
	violation: Violation,
	now: number,
): Promise<boolean> {
	const existing = await ctx.db
		.query("cspReports")
		.withIndex("by_key", (q) =>
			q
				.eq("disposition", violation.disposition)
				.eq("directive", violation.directive)
				.eq("blockedOrigin", violation.blockedOrigin)
				.eq("page", violation.page),
		)
		.unique();
	if (existing) {
		await ctx.db.patch(existing._id, {
			count: Math.min(existing.count + 1, MAX_COUNT_PER_KEY),
			lastSeen: now,
		});
		return true;
	}

	const rows = await ctx.db.query("cspReports").take(MAX_ROWS);
	if (rows.length >= MAX_ROWS) {
		console.warn(
			`[csp] cspReports is full (${MAX_ROWS} rows); dropped a new key`,
		);
		return false;
	}
	await ctx.db.insert("cspReports", {
		...violation,
		count: 1,
		firstSeen: now,
		lastSeen: now,
	});
	return true;
}

/** Every row, most recent first, with readable times. */
export const list = internalQuery({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db
			.query("cspReports")
			.withIndex("by_lastSeen")
			.order("desc")
			.take(MAX_ROWS);
		return rows.map((row) => ({
			disposition: row.disposition,
			directive: row.directive,
			blockedOrigin: row.blockedOrigin,
			page: row.page,
			count: row.count,
			firstSeen: new Date(row.firstSeen).toISOString(),
			lastSeen: new Date(row.lastSeen).toISOString(),
		}));
	},
});

/** Daily (convex/crons.ts): deletes rows not seen for RETENTION_MS, one batch per run of itself. */
export const deleteStale = internalMutation({
	args: {},
	handler: async (ctx) => {
		const cutoff = Date.now() - RETENTION_MS;
		const stale = await ctx.db
			.query("cspReports")
			.withIndex("by_lastSeen", (q) => q.lt("lastSeen", cutoff))
			.take(CLEANUP_BATCH);
		for (const row of stale) await ctx.db.delete(row._id);
		if (stale.length === CLEANUP_BATCH) {
			await ctx.scheduler.runAfter(0, internal.cspReports.deleteStale, {});
		}
		return { deleted: stale.length };
	},
});

/**
 * POST /csp-report on the Convex site URL, from `/api/csp-report` only. Needs
 * `Authorization: Bearer <CSP_REPORT_SECRET>` and a body of `{ violations: [...] }`. Answers 204,
 * 401 for a wrong secret, 400 for a bad body, and 503 when the deployment has no secret set.
 */
export const receive = httpAction(async (ctx, request) => {
	const secret = process.env[CSP_REPORT_SECRET_ENV];
	if (!secret) {
		console.error(`[csp] ${CSP_REPORT_SECRET_ENV} is not set`);
		return new Response(null, { status: 503 });
	}
	const presented = request.headers.get("authorization") ?? "";
	if (!timingSafeEqual(presented, `Bearer ${secret}`)) {
		return new Response(null, { status: 401 });
	}

	const declared = Number(request.headers.get("content-length") ?? 0);
	if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413 });
	const body = await request.text();
	if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
	const violations = parseBody(body);
	if (!violations) return new Response(null, { status: 400 });

	try {
		await ctx.runMutation(internal.cspReports.record, {
			violations,
			now: Date.now(),
		});
	} catch {
		// The argument validator rejected the shape.
		return new Response(null, { status: 400 });
	}
	return new Response(null, { status: 204 });
});

function parseBody(body: string): Violation[] | null {
	try {
		const parsed: unknown = JSON.parse(body);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("violations" in parsed) ||
			!Array.isArray(parsed.violations)
		) {
			return null;
		}
		return parsed.violations.slice(0, MAX_VIOLATIONS_PER_REQUEST);
	} catch {
		return null;
	}
}

function timingSafeEqual(a: string, b: string): boolean {
	const length = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;
	for (let i = 0; i < length; i += 1) {
		diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}
	return diff === 0;
}
