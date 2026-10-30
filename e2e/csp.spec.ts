import { ENFORCE_STRICT_CSP, ENFORCED_CSP } from "../src/lib/security/csp";
import { expect, test } from "./support/fixtures";

// The CSP and security headers (src/lib/security/). The strict policy is report-only until
// ENFORCE_STRICT_CSP is on, so these tests check that it is sent, that it would block what it should
// (the browser reports a violation), and that the enforced subset really blocks. csp-enforced.spec.ts
// covers the strict policy enforced.

test("pages carry the security headers and a per-request nonce", async ({
	request,
}) => {
	const first = await request.get("/login");
	const second = await request.get("/login");
	const headers = first.headers();

	expect(headers["strict-transport-security"]).toContain("max-age=");
	expect(headers["x-content-type-options"]).toBe("nosniff");
	expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
	expect(headers["permissions-policy"]).toContain("camera=()");
	expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
	expect(headers["x-frame-options"]).toBe("DENY");
	const policy = headers["content-security-policy-report-only"] ?? "";
	expect(headers["content-security-policy"]).toBe(
		ENFORCE_STRICT_CSP ? policy : ENFORCED_CSP,
	);
	expect(ENFORCED_CSP).toBe(
		"object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
	);

	expect(policy).toContain("'strict-dynamic'");
	expect(policy).not.toContain("'unsafe-eval'");
	expect(policy).toContain("report-uri /api/csp-report");
	expect(policy).toMatch(/connect-src 'self' [^;]*https:\/\/api\.openai\.com/);
	expect(policy).toMatch(/img-src 'self' data: blob:;/);

	const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
	const otherNonce = /'nonce-([^']+)'/.exec(
		second.headers()["content-security-policy-report-only"] ?? "",
	)?.[1];
	expect(nonce).toBeTruthy();
	expect(otherNonce).not.toBe(nonce);

	// Every script in the page carries this response's nonce.
	const html = await first.text();
	const scripts = html.match(/<script\b[^>]*>/g) ?? [];
	expect(scripts.length).toBeGreaterThan(0);
	for (const script of scripts) {
		expect(script).toContain(`nonce="${nonce}"`);
	}
});

test("server routes get the security headers too", async ({ request }) => {
	const response = await request.post("/api/csp-report", { data: "{}" });
	expect(response.status()).toBe(204);
	expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test.describe("violations", () => {
	test.use({ allowCspViolations: true });

	test("an injected inline handler is reported", async ({
		page,
		cspViolations,
	}) => {
		await page.goto("/e2e/composer");
		await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
		expect(cspViolations).toEqual([]);

		// What an HTML-injection bug looks like: parser-inserted markup with an event handler. (A script
		// element created from page code would be allowed: 'strict-dynamic' trusts what trusted
		// scripts add.)
		await page.evaluate(() => {
			document.body.insertAdjacentHTML(
				"beforeend",
				'<img src="data:," onerror="window.__injected = 1">',
			);
		});

		await expect
			.poll(() => cspViolations.map((violation) => violation.directive))
			.toContain("script-src-attr");
		// Report-only until ENFORCE_STRICT_CSP is on; then the report-only copy reports it too.
		await expect
			.poll(() => cspViolations.map((violation) => violation.disposition))
			.toContain(ENFORCE_STRICT_CSP ? "enforce" : "report");
	});

	test("a connection to an unlisted origin is reported", async ({
		page,
		cspViolations,
	}) => {
		await page.goto("/e2e/composer");
		await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

		// IPv6 loopback: not on the allowlist, but it stays on this machine (the fixture fails any
		// request that leaves it, and nothing listens on port 9).
		await page.evaluate(() => fetch("http://[::1]:9/steal").catch(() => {}));

		await expect
			.poll(() => cspViolations.map((violation) => violation.blocked))
			.toContain("http://[::1]:9/steal");
		expect(cspViolations[0]?.directive).toBe("connect-src");
	});

	test("the enforced policy blocks an injected <base>", async ({
		page,
		cspViolations,
	}) => {
		await page.goto("/e2e/composer");
		await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

		const baseURI = await page.evaluate(() => {
			const base = document.createElement("base");
			base.href = "https://attacker.example/";
			document.head.append(base);
			return document.baseURI;
		});

		expect(baseURI).not.toContain("attacker.example");
		await expect
			.poll(() =>
				cspViolations
					.filter((violation) => violation.disposition === "enforce")
					.map((violation) => violation.directive),
			)
			.toContain("base-uri");
	});
});

// browser-image-compression's worker mode loads the library from a CDN; the composer must not.
test("attaching an image fetches nothing from other origins", async ({
	page,
	context,
}) => {
	const offMachine: string[] = [];
	context.on("request", (request) => {
		if (
			!/^(blob|data):|^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(
				request.url(),
			)
		) {
			offMachine.push(request.url());
		}
	});
	await page.goto("/e2e/composer");
	await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

	await page.locator('input[type="file"].hidden').setInputFiles({
		name: "pixel.png",
		mimeType: "image/png",
		// A 1x1 PNG.
		buffer: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
			"base64",
		),
	});

	await expect(page.locator('img[src^="blob:"]')).toBeVisible();
	expect(offMachine).toEqual([]);
});
