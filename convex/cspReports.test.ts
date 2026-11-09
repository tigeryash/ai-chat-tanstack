import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import { MAX_COUNT_PER_KEY, MAX_ROWS, RETENTION_MS } from "./cspReports";
import { createConvexTest } from "./test.helpers";

const SECRET = "test-secret";
const violation = {
	disposition: "report" as const,
	directive: "script-src-elem",
	blockedOrigin: "https://evil.test",
	page: "/[chatId]",
};

function post(
	t: ReturnType<typeof createConvexTest>,
	body: unknown,
	secret = SECRET,
) {
	return t.fetch("/csp-report", {
		method: "POST",
		headers: {
			authorization: `Bearer ${secret}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

function rows(t: ReturnType<typeof createConvexTest>) {
	return t.run((ctx) => ctx.db.query("cspReports").collect());
}

beforeEach(() => {
	vi.stubEnv("CSP_REPORT_SECRET", SECRET);
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("/csp-report HTTP action", () => {
	it("upserts one row per key and counts repeats", async () => {
		const t = createConvexTest();
		expect((await post(t, { violations: [violation, violation] })).status).toBe(
			204,
		);
		expect(
			(await post(t, { violations: [{ ...violation, page: "/settings" }] }))
				.status,
		).toBe(204);

		const stored = await rows(t);
		expect(stored).toHaveLength(2);
		const chat = stored.find((row) => row.page === "/[chatId]");
		expect(chat).toMatchObject({ ...violation, count: 2 });
		expect(chat?.lastSeen).toBeGreaterThanOrEqual(chat?.firstSeen ?? 0);
	});

	it("refuses a wrong or missing secret, and every request when none is set", async () => {
		const t = createConvexTest();
		expect((await post(t, { violations: [violation] }, "wrong")).status).toBe(
			401,
		);
		const bare = await t.fetch("/csp-report", {
			method: "POST",
			body: JSON.stringify({ violations: [violation] }),
		});
		expect(bare.status).toBe(401);

		vi.stubEnv("CSP_REPORT_SECRET", "");
		expect((await post(t, { violations: [violation] }, "")).status).toBe(503);
		expect(await rows(t)).toEqual([]);
	});

	it("rejects bad bodies and drops anything that isn't already reduced", async () => {
		const t = createConvexTest();
		expect((await post(t, { nope: true })).status).toBe(400);
		expect((await post(t, { violations: [{ directive: "x" }] })).status).toBe(
			400,
		);

		const unreduced = [
			{ ...violation, blockedOrigin: "https://evil.test/path?q=1" },
			{ ...violation, page: "/k57abc?token=secret" },
			{ ...violation, page: "/reset-password#frag" },
			{ ...violation, directive: "script-src 'self'" },
			{ ...violation, blockedOrigin: `https://${"a".repeat(300)}.test` },
		];
		expect((await post(t, { violations: unreduced })).status).toBe(204);
		expect(await rows(t)).toEqual([]);
	});
});

describe("cspReports caps", () => {
	it("stops adding keys at MAX_ROWS but keeps counting existing ones", async () => {
		const t = createConvexTest();
		const now = Date.now();
		await t.run(async (ctx) => {
			for (let i = 0; i < MAX_ROWS; i += 1) {
				await ctx.db.insert("cspReports", {
					...violation,
					blockedOrigin: `https://host${i}.test`,
					count: 1,
					firstSeen: now,
					lastSeen: now,
				});
			}
		});

		const result = await t.mutation(internal.cspReports.record, {
			violations: [
				{ ...violation, blockedOrigin: "https://new.test" },
				{ ...violation, blockedOrigin: "https://host0.test" },
			],
			now,
		});
		expect(result).toEqual({ stored: 1 });
		const stored = await rows(t);
		expect(stored).toHaveLength(MAX_ROWS);
		expect(
			stored.find((row) => row.blockedOrigin === "https://host0.test")?.count,
		).toBe(2);
	});

	it("saturates a key's count at MAX_COUNT_PER_KEY", async () => {
		const t = createConvexTest();
		const now = Date.now();
		await t.run((ctx) =>
			ctx.db.insert("cspReports", {
				...violation,
				count: MAX_COUNT_PER_KEY,
				firstSeen: now,
				lastSeen: now,
			}),
		);
		await t.mutation(internal.cspReports.record, {
			violations: [violation],
			now: now + 1,
		});
		const [row] = await rows(t);
		expect(row).toMatchObject({ count: MAX_COUNT_PER_KEY, lastSeen: now + 1 });
	});

	it("handles at most 20 violations per request", async () => {
		const t = createConvexTest();
		const many = Array.from({ length: 30 }, (_, i) => ({
			...violation,
			blockedOrigin: `https://host${i}.test`,
		}));
		const result = await t.mutation(internal.cspReports.record, {
			violations: many,
			now: Date.now(),
		});
		expect(result).toEqual({ stored: 20 });
	});
});

describe("cspReports.deleteStale and list", () => {
	it("deletes rows not seen for 30 days and lists the rest", async () => {
		const t = createConvexTest();
		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.insert("cspReports", {
				...violation,
				count: 3,
				firstSeen: now - RETENTION_MS - 10_000,
				lastSeen: now - RETENTION_MS - 1000,
			});
			await ctx.db.insert("cspReports", {
				...violation,
				page: "/settings",
				count: 1,
				firstSeen: now - RETENTION_MS - 10_000,
				lastSeen: now - 1000,
			});
		});

		expect(await t.mutation(internal.cspReports.deleteStale, {})).toEqual({
			deleted: 1,
		});
		const listed = await t.query(internal.cspReports.list, {});
		expect(listed).toEqual([
			{
				...violation,
				page: "/settings",
				count: 1,
				firstSeen: new Date(now - RETENTION_MS - 10_000).toISOString(),
				lastSeen: new Date(now - 1000).toISOString(),
			},
		]);
	});

	it("schedules another run when a batch is full", async () => {
		vi.useFakeTimers();
		const t = createConvexTest();
		const old = Date.now() - RETENTION_MS - 1000;
		await t.run(async (ctx) => {
			for (let i = 0; i < 250; i += 1) {
				await ctx.db.insert("cspReports", {
					...violation,
					blockedOrigin: `https://host${i}.test`,
					count: 1,
					firstSeen: old,
					lastSeen: old,
				});
			}
		});
		expect(await t.mutation(internal.cspReports.deleteStale, {})).toEqual({
			deleted: 200,
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await rows(t)).toEqual([]);
		vi.useRealTimers();
	});
});
