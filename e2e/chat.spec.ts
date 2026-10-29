import type { Page } from "@playwright/test";
import { MOCK_REASONING, MOCK_REPLY } from "../src/routes/e2e/-mock-chat";
import { expect, test } from "./support/fixtures";

// Roadmap 1.2: the chat view on `useChat` with the browser transport (/e2e/chat), streaming from the
// AI SDK mock model. The transport and chat store are real; only the model is scripted.

const reasoningText = MOCK_REASONING.join("");
const replyText = MOCK_REPLY.join("").trim();

async function open(page: Page, search = "") {
	await page.goto(`/e2e/chat${search}`);
	await expect(page.locator("main[data-chat-id]")).toBeAttached();
}

async function send(page: Page, text: string) {
	const box = page.getByPlaceholder("Ask anything");
	await box.fill(text);
	await box.press("Enter");
}

const status = (page: Page) => page.locator("[data-chat-status]");
const reply = (page: Page) =>
	page.locator("[data-slot='message']").filter({ hasText: "word1" });

test("a reply streams in, reasoning first and live, then saves locally", async ({
	page,
}) => {
	await open(page);
	await send(page, "Hello mock");

	// Reasoning shows while it streams, before any of the answer.
	await expect(page.getByText("Thinking...")).toBeVisible();
	await expect(page.getByText(reasoningText)).toBeVisible();
	await expect(status(page)).toHaveAttribute("data-chat-status", "streaming");
	// The answer arrives in pieces: part of it is on screen before the end.
	await expect(reply(page)).toContainText("word5");
	expect(await reply(page).textContent()).not.toContain("word40");
	await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

	await expect(reply(page)).toContainText(replyText);
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready");
	await expect(page.getByText(/Thought for/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);

	// Saved in IndexedDB when the reply finished: a fresh page load reopens it.
	const chatId = await page.locator("main").getAttribute("data-chat-id");
	await open(page, `?chat=${chatId}`);
	await expect(page.getByText("Hello mock")).toBeVisible();
	await expect(reply(page)).toContainText(replyText);
});

test("Stop ends the reply where it is, keeps it, and allows a new message", async ({
	page,
}) => {
	await open(page);
	await send(page, "Hello mock");
	await expect(reply(page)).toContainText("word3");

	await page.getByRole("button", { name: "Stop" }).click();
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready");
	const stopped = await reply(page).textContent();
	expect(stopped).not.toContain("word40");
	// Nothing more arrives after Stop.
	await page.waitForTimeout(500);
	expect(await reply(page).textContent()).toBe(stopped);

	// The stopped chat is saved, and the next message gets a full reply.
	await send(page, "Again");
	await expect(page.getByText("Again")).toBeVisible();
	await expect(
		page.locator("[data-slot='message']").filter({ hasText: "word40" }),
	).toHaveCount(1);
});

test("Regenerate replaces the last reply", async ({ page }) => {
	await open(page);
	await send(page, "Hello mock");
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready", {
		timeout: 10_000,
	});

	await page.getByRole("button", { name: "Regenerate response" }).click();
	await expect(status(page)).toHaveAttribute("data-chat-status", "streaming");
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready", {
		timeout: 10_000,
	});
	await expect(reply(page)).toHaveCount(1);
	await expect(reply(page)).toContainText(replyText);
});

test("finished reasoning reopens collapsed after a reload, without opening first", async ({
	page,
}) => {
	// Records, from the first paint, whether a reasoning panel was ever open on this page load.
	await page.addInitScript(() => {
		const seen = { opened: false };
		Object.assign(window, { __reasoning: seen });
		new MutationObserver(() => {
			if (
				document.querySelector(
					"[data-slot='trace-collapsible-content'], [data-slot='trace-collapsible-trigger'][aria-expanded='true']",
				)
			) {
				seen.opened = true;
			}
		}).observe(document, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["aria-expanded"],
		});
	});
	await open(page);
	await send(page, "Hello mock");
	// A live reply opens its reasoning.
	await expect(page.getByText(reasoningText)).toBeVisible();
	await expect(status(page)).toHaveAttribute("data-chat-status", "ready");

	const chatId = await page.locator("main").getAttribute("data-chat-id");
	await open(page, `?chat=${chatId}`);
	await expect(reply(page)).toContainText(replyText);
	const trigger = page.getByRole("button", { name: /Thought for/ });
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	// Past the old auto-close delay: it never opened, so it never had to close.
	await page.waitForTimeout(1500);
	expect(
		await page.evaluate(
			() =>
				(window as unknown as { __reasoning: { opened: boolean } }).__reasoning
					.opened,
		),
	).toBe(false);
	await expect(page.getByText(reasoningText)).toHaveCount(0);

	// Still opens on request.
	await trigger.click();
	await expect(page.getByText(reasoningText)).toBeVisible();
});
