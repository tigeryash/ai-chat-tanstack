import {
	ATTACKER_ORIGIN,
	HUGE_PAYLOADS,
	XSS_PAYLOADS,
} from "../src/routes/e2e/-xss-payloads";
import { expect, test } from "./support/fixtures";

// Hostile model output rendered through MessageResponse and ReasoningContent (/e2e/markdown). The
// fixture also fails each test on any request leaving the machine (so no remote image or frame
// loaded), any uncaught page error, and any CSP violation.

declare global {
	interface Window {
		__xss?: number;
	}
}

// The rendered markdown itself (SafeMarkdown marks it), without the message and Trace chrome around it.
const RENDERED = "main [data-markdown]";

test.describe("model output with XSS payloads", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/e2e/markdown");
		await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
		// SafeMarkdown shows plain text until Streamdown loads; check what Streamdown renders.
		await expect(
			page.locator(`${RENDERED} [data-streamdown="loading"]`),
		).toHaveCount(0);
	});

	test("renders every payload in both the reply and the reasoning", async ({
		page,
	}) => {
		for (const { name } of XSS_PAYLOADS) {
			const section = page.locator(`section[data-payload="${name}"]`);
			await expect(section.getByTestId("reply")).toBeVisible();
			await expect(section.getByTestId("reasoning")).toBeVisible();
		}
	});

	test("no payload runs script", async ({ page }) => {
		// Fire hover and focus events at everything the payloads produced, in case a handler
		// survived. Dispatched in the page in one pass: hovering each element through Playwright took over
		// 30 seconds on CI and timed the test out.
		const fired = await page.evaluate((selector) => {
			const events = ["pointerover", "mouseover", "mouseenter", "focus"];
			const elements = [...document.querySelectorAll(selector)];
			for (const element of elements) {
				for (const type of events) {
					element.dispatchEvent(new MouseEvent(type, { bubbles: true }));
				}
			}
			return elements.length;
		}, `${RENDERED} *`);
		expect(fired).toBeGreaterThan(0);
		expect(await page.evaluate(() => window.__xss)).toBeUndefined();
	});

	test("no dangerous elements or attributes reach the DOM", async ({
		page,
	}) => {
		const found = await page.evaluate((selector) => {
			const roots = [...document.querySelectorAll(selector)];
			const all = roots.flatMap((root) => [...root.querySelectorAll("*")]);
			return {
				tags: all
					.map((element) => element.tagName.toLowerCase())
					.filter((tag) =>
						[
							"script",
							"iframe",
							"object",
							"embed",
							"form",
							"base",
							"meta",
							"link",
							"style",
							"img",
							"video",
							"audio",
							"source",
							"svg",
						].includes(tag),
					),
				handlers: all.flatMap((element) =>
					[...element.attributes]
						.filter((attribute) => attribute.name.startsWith("on"))
						.map((attribute) => `${element.tagName} ${attribute.name}`),
				),
				styles: all.filter((element) => element.hasAttribute("style")).length,
			};
		}, RENDERED);

		expect(found.tags).toEqual([]);
		expect(found.handlers).toEqual([]);
		expect(found.styles).toBe(0);
	});

	test("links are https, http or mailto, open in a new tab, and show their real host", async ({
		page,
	}) => {
		const links = await page.locator(`${RENDERED} a`).evaluateAll((anchors) =>
			anchors.map((anchor) => ({
				href: anchor.getAttribute("href") ?? "",
				rel: anchor.getAttribute("rel"),
				target: anchor.getAttribute("target"),
				title: anchor.getAttribute("title") ?? "",
			})),
		);

		expect(links.length).toBeGreaterThan(0);
		for (const link of links) {
			expect(link.href).toMatch(/^(https?:\/\/|mailto:)/);
			expect(link.rel).toBe("noopener noreferrer");
			expect(link.target).toBe("_blank");
		}
		const spoofed = page
			.locator('section[data-payload="allowed links"] [data-testid=reply]')
			.getByRole("link", { name: "spoofed" });
		await expect(spoofed).toHaveAttribute("title", "attacker.example");
	});

	test("javascript: links, inline and reference-style, render as text", async ({
		page,
	}) => {
		for (const name of ["javascript links", "reference-style links"]) {
			const reply = page.locator(
				`section[data-payload="${name}"] [data-testid=reply]`,
			);
			await expect(reply.locator('a[href^="javascript" i]')).toHaveCount(0);
			await expect(reply.locator('a[href^="data" i]')).toHaveCount(0);
			await expect(reply.locator('a[href^="vbscript" i]')).toHaveCount(0);
		}
		const inline = page.locator(
			'section[data-payload="javascript links"] [data-testid=reply]',
		);
		await expect(inline.getByText("inline", { exact: false })).toBeVisible();
		await expect(inline.getByRole("link")).toHaveCount(0);
	});

	test("remote images are offered as links, never loaded", async ({ page }) => {
		const reply = page.locator(
			'section[data-payload="remote images"] [data-testid=reply]',
		);
		await expect(reply.locator("img")).toHaveCount(0);
		const placeholder = reply
			.locator('[data-streamdown="image-placeholder"]')
			.first();
		await expect(placeholder).toContainText("attacker.example");
		await expect(placeholder).toHaveAttribute("rel", "noopener noreferrer");

		const loaded = await page.evaluate(
			(origin) =>
				performance
					.getEntriesByType("resource")
					.filter((entry) => entry.name.startsWith(origin)).length,
			ATTACKER_ORIGIN,
		);
		expect(loaded).toBe(0);
	});
});

test("huge payloads render without hanging or crashing", async ({ page }) => {
	await page.goto("/e2e/markdown?huge=true");
	await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true", {
		timeout: 15_000,
	});
	// Wait for Streamdown to load and parse them, not just the plain text shown until it does.
	await expect(
		page.locator(`${RENDERED} [data-streamdown="loading"]`),
	).toHaveCount(0, { timeout: 15_000 });

	for (const { name } of HUGE_PAYLOADS) {
		await expect(
			page.locator(`section[data-payload="${name}"] [data-testid=reply]`),
		).toBeVisible();
	}
	// The pathological ones fall back to plain text (src/lib/security/markdown-limits.ts).
	for (const name of ["deep blockquotes", "deep lists", "unclosed emphasis"]) {
		await expect(
			page.locator(
				`section[data-payload="${name}"] [data-testid=reply] [data-streamdown="plain-text"]`,
			),
		).toBeVisible();
	}
	// The page still responds.
	expect(await page.evaluate(() => 1 + 1)).toBe(2);
	expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
