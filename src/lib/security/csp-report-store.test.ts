import { describe, expect, it, vi } from "vitest";
import type { CspViolation } from "@/lib/security/csp-report";
import { storeCspViolations } from "@/lib/security/csp-report-store";

const violation: CspViolation = {
	disposition: "report",
	directive: "script-src-elem",
	blocked: "https://evil.test",
	page: "/[chatId]",
};
const env = { siteUrl: "https://example.convex.site", secret: "s3cret" };

describe("storeCspViolations", () => {
	it("posts the reduced fields to Convex's /csp-report with the shared secret", async () => {
		const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
		await storeCspViolations([violation], env, fetchImpl);

		expect(fetchImpl).toHaveBeenCalledOnce();
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [
			URL,
			RequestInit,
		];
		expect(url.toString()).toBe("https://example.convex.site/csp-report");
		expect(init.headers).toMatchObject({ authorization: "Bearer s3cret" });
		expect(JSON.parse(String(init.body))).toEqual({
			violations: [
				{
					disposition: "report",
					directive: "script-src-elem",
					blockedOrigin: "https://evil.test",
					page: "/[chatId]",
				},
			],
		});
	});

	it("sends nothing without a secret, a site URL, or violations", async () => {
		const fetchImpl = vi.fn();
		await storeCspViolations(
			[violation],
			{ ...env, secret: undefined },
			fetchImpl,
		);
		await storeCspViolations(
			[violation],
			{ ...env, siteUrl: undefined },
			fetchImpl,
		);
		await storeCspViolations([], env, fetchImpl);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("never throws when Convex fails or refuses", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			storeCspViolations([violation], env, async () => {
				throw new TypeError("network down");
			}),
		).resolves.toBeUndefined();
		await storeCspViolations(
			[violation],
			env,
			async () => new Response(null, { status: 401 }),
		);
		expect(warn.mock.calls.map((call) => call[0])).toEqual([
			"[csp] storing reports failed: TypeError",
			"[csp] storing reports failed with status 401",
		]);
		warn.mockRestore();
	});
});
