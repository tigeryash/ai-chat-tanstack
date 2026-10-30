import { expect, test } from "./support/fixtures";

// Runs only in the `csp-enforced` project (playwright.config.ts), where the server enforces every
// page's strict policy the way ENFORCE_STRICT_CSP does (src/lib/security/csp.ts, src/start.ts). The
// other specs in that project prove the app works enforced; these prove the policy really blocks.

test.use({ allowCspViolations: true });

test("the strict policy is enforced, with a report-only copy", async ({
	page,
}) => {
	const response = await page.goto("/e2e/composer");
	const headers = response?.headers() ?? {};
	expect(headers["content-security-policy"]).toContain("'strict-dynamic'");
	expect(headers["content-security-policy-report-only"]).toBe(
		headers["content-security-policy"],
	);
});

test("an injected inline handler is blocked", async ({
	page,
	cspViolations,
}) => {
	await page.goto("/e2e/composer");
	await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
	expect(cspViolations).toEqual([]);

	await page.evaluate(() => {
		document.body.insertAdjacentHTML(
			"beforeend",
			'<img src="data:," onerror="window.__injected = 1">',
		);
	});

	await expect
		.poll(() =>
			cspViolations
				.filter((violation) => violation.disposition === "enforce")
				.map((violation) => violation.directive),
		)
		.toContain("script-src-attr");
	expect(
		await page.evaluate(() => (window as { __injected?: number }).__injected),
	).toBeUndefined();
});

test("a connection to an unlisted origin is blocked", async ({
	page,
	cspViolations,
}) => {
	await page.goto("/e2e/composer");
	await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

	// IPv6 loopback: not on the allowlist, and it stays on this machine. The enforce-disposition
	// violation is what shows the CSP, not the closed port, stopped it.
	const outcome = await page.evaluate(() =>
		fetch("http://[::1]:9/steal").then(
			() => "sent",
			() => "blocked",
		),
	);

	expect(outcome).toBe("blocked");
	await expect
		.poll(() =>
			cspViolations
				.filter((violation) => violation.disposition === "enforce")
				.map((violation) => violation.blocked),
		)
		.toContain("http://[::1]:9/steal");
});
