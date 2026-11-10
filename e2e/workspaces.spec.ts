import type { Page } from "@playwright/test";
import {
	E2E_SLOW_MODEL,
	e2eMockModel,
	e2eMockReply,
} from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";
import {
	composer,
	MODELS,
	openWorkspace,
	pane,
	panes,
	pickModel,
	savedMessages,
	setUp,
	status,
} from "./support/workspaces";

// The workspace screenshots mask the composer (quality audit Q2 T3): e2e/composer-design.spec.ts is its only
// baseline, so a workspace change never refreshes an image of the composer (hard rule 8), and an approved
// composer change never refreshes these.
const COMPOSER = ".composer-design";

// Roadmaps 3.1 and 3.2: panes side by side, each with its own model, synced composers, Stop, the
// "Diverged" badge, and a workspace that survives a reload. The models are e2e mock models listed by a
// stubbed local server, so every reply comes from MockLanguageModelV4 (hard rule 6).

test("three panes with their own models: synced and unsynced sends, the Diverged badge, and a reload", async ({
	page,
	context,
}) => {
	await setUp(context, page, e2eMockModel("alpha"));
	await openWorkspace(page, 4);
	// Four is the limit; closing one leaves three.
	await expect(page.getByRole("button", { name: "Add pane" })).toBeDisabled();
	await pane(page, 4).getByRole("button", { name: "Close Pane 4" }).click();
	await expect(panes(page)).toHaveCount(3);
	await pickModel(pane(page, 2), page, e2eMockModel("beta"));
	await pickModel(pane(page, 3), page, e2eMockModel("gamma"));

	// Typing in one synced pane mirrors into the others; sending sends to every one, each to its model.
	await composer(pane(page, 2)).fill("Compare these");
	for (const n of [1, 3]) {
		await expect(composer(pane(page, n))).toHaveValue("Compare these");
	}
	await composer(pane(page, 2)).press("Enter");
	for (const [index, name] of MODELS.entries()) {
		await expect(
			pane(page, index + 1).getByText(e2eMockReply(name)),
		).toBeVisible();
		await expect(status(pane(page, index + 1))).toHaveAttribute(
			"data-chat-status",
			"ready",
		);
	}
	await expect(composer(pane(page, 1))).toHaveValue("");
	await expect(
		page.getByRole("status").filter({ hasText: "Diverged" }),
	).toHaveCount(0);

	// An unsynced pane is on its own: its draft and send stay there.
	await pane(page, 3).getByRole("switch", { name: "Sync Pane 3" }).click();
	await composer(pane(page, 3)).fill("Only gamma");
	await expect(composer(pane(page, 1))).toHaveValue("");
	await composer(pane(page, 3)).press("Enter");
	await expect(pane(page, 3).getByText(e2eMockReply("gamma"))).toHaveCount(2);
	await expect(pane(page, 1).getByText("Only gamma")).toHaveCount(0);
	await expect(pane(page, 2).getByText("Only gamma")).toHaveCount(0);

	// Synced again, its history differs from the others' (decision 16).
	await pane(page, 3).getByRole("switch", { name: "Sync Pane 3" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "Diverged" }),
	).toBeVisible();

	// Reorder: gamma moves to the front.
	await pane(page, 3)
		.getByRole("button", { name: "Options for Pane 3" })
		.click();
	await page.getByRole("menuitem", { name: "Move left" }).click();
	await pane(page, 2)
		.getByRole("button", { name: "Options for Pane 2" })
		.click();
	await page.getByRole("menuitem", { name: "Move left" }).click();
	await expect(pane(page, 1).getByText("Only gamma")).toBeVisible();

	// Widen the first pane from the keyboard.
	const before = await pane(page, 1).boundingBox();
	await page.getByRole("separator", { name: "Resize panes 1 and 2" }).focus();
	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");
	await expect
		.poll(async () => (await pane(page, 1).boundingBox())?.width)
		.toBeGreaterThan((before?.width ?? 0) + 20);
	const widths = await panes(page).evaluateAll((sections) =>
		sections.map((section) =>
			Math.round(section.getBoundingClientRect().width),
		),
	);

	// The sidebar shows the workspace once, with its pane count.
	const entry = page.getByRole("link", { name: /Only gamma|Compare these/ });
	await expect(entry).toHaveCount(1);
	await expect(entry).toContainText("3");

	await page.reload();
	await expect(panes(page)).toHaveCount(3);
	await expect(pane(page, 1).getByText("Only gamma")).toBeVisible();
	await expect(pane(page, 2).getByText(e2eMockReply("alpha"))).toBeVisible();
	await expect(pane(page, 3).getByText(e2eMockReply("beta"))).toBeVisible();
	await expect(
		pane(page, 1).getByRole("button", { name: /^Model: / }),
	).toContainText(e2eMockModel("gamma"));
	await expect(
		page.getByRole("status").filter({ hasText: "Diverged" }),
	).toBeVisible();
	const restored = await panes(page).evaluateAll((sections) =>
		sections.map((section) =>
			Math.round(section.getBoundingClientRect().width),
		),
	);
	for (const [index, width] of widths.entries()) {
		expect(Math.abs((restored[index] ?? 0) - width)).toBeLessThanOrEqual(2);
	}
});

test("the composer's Stop stops every synced pane; a pane's own Stop only that pane", async ({
	page,
	context,
}) => {
	await setUp(context, page, E2E_SLOW_MODEL);
	await openWorkspace(page, 3);

	await pane(page, 3).getByRole("switch", { name: "Sync Pane 3" }).click();
	await composer(pane(page, 3)).fill("On my own");
	await composer(pane(page, 3)).press("Enter");
	await composer(pane(page, 1)).fill("All together");
	await composer(pane(page, 1)).press("Enter");
	for (const n of [1, 2, 3]) {
		await expect(status(pane(page, n))).toHaveAttribute(
			"data-chat-status",
			"streaming",
		);
	}

	// A pane's own Stop.
	await pane(page, 2).getByRole("button", { name: "Stop Pane 2" }).click();
	await expect(status(pane(page, 2))).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
	await expect(status(pane(page, 1))).toHaveAttribute(
		"data-chat-status",
		"streaming",
	);

	// Pane 2 is idle now; the composer's Stop stops the synced panes still replying, not pane 3.
	await pane(page, 2)
		.getByRole("button", { name: "Stop", exact: true })
		.click();
	await expect(status(pane(page, 1))).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
	await expect(status(pane(page, 3))).toHaveAttribute(
		"data-chat-status",
		"streaming",
	);

	await pane(page, 3)
		.getByRole("button", { name: "Stop", exact: true })
		.click();
	await expect(status(pane(page, 3))).toHaveAttribute(
		"data-chat-status",
		"ready",
	);
});

/** A one-finger swipe across the shown pane, through Chromium's touch input (roadmap 3.8). */
async function swipe(page: Page, direction: "left" | "right") {
	const box = await page.locator("[data-pane-swipe]").boundingBox();
	if (!box) throw new Error("No pane area to swipe on");
	const y = box.y + box.height / 3;
	const [from, to] =
		direction === "left"
			? [box.x + box.width * 0.8, box.x + box.width * 0.2]
			: [box.x + box.width * 0.2, box.x + box.width * 0.8];
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
		cdp.send("Input.dispatchTouchEvent", {
			type,
			touchPoints: type === "touchEnd" ? [] : [{ x, y }],
		});
	await touch("touchStart", from);
	for (let step = 1; step <= 5; step++) {
		await touch("touchMove", from + ((to - from) * step) / 5);
	}
	await touch("touchEnd", to);
	await cdp.detach();
}

// Roadmap 3.8: below `md`, panes become tabs that a tap, a swipe or the keyboard switches.
test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test("one pane shows at a time; tabs, swipes and arrow keys switch panes", async ({
		page,
		context,
	}) => {
		await setUp(context, page, e2eMockModel("alpha"));
		await openWorkspace(page, 3);
		const tablist = page.getByRole("tablist", { name: "Panes" });
		const tabs = tablist.getByRole("tab");
		const tab = (n: number) => tablist.getByRole("tab", { name: `Pane ${n}` });
		const shows = async (n: number) => {
			await expect(tab(n)).toHaveAttribute("aria-selected", "true");
			for (const other of [1, 2, 3]) {
				if (other === n) await expect(pane(page, other)).toBeVisible();
				else await expect(pane(page, other)).toBeHidden();
			}
			await expect(
				page.getByRole("tabpanel", { name: `Pane ${n}` }),
			).toBeVisible();
		};
		await expect(tabs).toHaveText(["Pane 1", "Pane 2", "Pane 3"]);
		// Adding a pane shows it.
		await shows(3);

		// A tap switches panes.
		await tab(1).tap();
		await shows(1);

		// A synced send also reaches the hidden panes.
		await composer(pane(page, 1)).fill("Hi all");
		await composer(pane(page, 1)).press("Enter");
		await expect(pane(page, 1).getByText(e2eMockReply("alpha"))).toBeVisible();

		// Swiping left shows the next pane, right the previous; neither goes past the ends.
		await swipe(page, "right");
		await shows(1);
		await swipe(page, "left");
		await shows(2);
		await expect(pane(page, 2).getByText(e2eMockReply("alpha"))).toBeVisible();
		await swipe(page, "left");
		await shows(3);
		await expect(pane(page, 3).getByText(e2eMockReply("alpha"))).toBeVisible();
		await swipe(page, "left");
		await shows(3);
		await swipe(page, "right");
		await shows(2);

		// The keyboard: one tab stop, arrows move (and wrap), Home and End jump.
		await expect(tab(2)).toHaveAttribute("tabindex", "0");
		await expect(tab(1)).toHaveAttribute("tabindex", "-1");
		await tab(2).focus();
		await page.keyboard.press("ArrowRight");
		await shows(3);
		await expect(tab(3)).toBeFocused();
		await page.keyboard.press("ArrowRight");
		await shows(1);
		await page.keyboard.press("End");
		await shows(3);
		await page.keyboard.press("Home");
		await shows(1);
		await expect(tab(1)).toBeFocused();
	});

	test("screenshot: a three-pane workspace on a phone", async ({
		page,
		context,
	}) => {
		await setUp(context, page, e2eMockModel("alpha"));
		await openWorkspace(page, 3);
		await page.getByRole("tab", { name: "Pane 1" }).tap();
		await composer(pane(page, 1)).fill("Compare these");
		await composer(pane(page, 1)).press("Enter");
		await expect(pane(page, 1).getByText(e2eMockReply("alpha"))).toBeVisible();
		await composer(pane(page, 1)).blur();
		// The header's usage figure shrinks to an icon, so the model name keeps room to be read.
		await expect(pane(page, 1).locator("[data-usage='chat']")).toBeVisible();
		const name = pane(page, 1)
			.getByRole("button", { name: /^Model: / })
			.locator(".truncate");
		await expect(name).toHaveText(e2eMockModel("alpha"));
		const shown = await name.evaluate((el) => el.clientWidth / el.scrollWidth);
		expect(shown).toBeGreaterThan(0.35);
		// Three tabs fit beside the header's buttons without the tab row scrolling (none cut off).
		const tabRow = page.getByRole("tablist", { name: "Panes" });
		expect(
			await tabRow.evaluate((row) => row.scrollWidth <= row.clientWidth),
		).toBe(true);
		// Usage and timings (roadmap 2.5) vary run to run; e2e/usage.spec.ts covers them.
		await page.addStyleTag({
			content: "[data-usage] { display: none !important; }",
		});
		await expect(page).toHaveScreenshot("workspace-phone.png", {
			mask: [page.locator(COMPOSER)],
		});
	});
});

test("screenshot: three panes side by side", async ({ page, context }) => {
	await setUp(context, page, e2eMockModel("alpha"));
	await openWorkspace(page, 3);
	await pickModel(pane(page, 2), page, e2eMockModel("beta"));
	await pickModel(pane(page, 3), page, e2eMockModel("gamma"));
	await composer(pane(page, 1)).fill("Compare these");
	await composer(pane(page, 1)).press("Enter");
	for (const [index, name] of MODELS.entries()) {
		await expect(
			pane(page, index + 1).getByText(e2eMockReply(name)),
		).toBeVisible();
	}
	await page.mouse.move(0, 0);
	// Usage and timings (roadmap 2.5) vary run to run; e2e/usage.spec.ts covers them.
	await page.addStyleTag({
		content: "[data-usage] { display: none !important; }",
	});
	await expect(
		page.locator("main, [data-slot=sidebar-inset]").first(),
	).toHaveScreenshot("workspace-three-panes.png", {
		mask: [page.locator(COMPOSER)],
	});
});

// Quality audit Q2, W1: the tab keeps at most 8 idle chats open, so opening 9 others releases the ones
// shown before. Coming back has to read them from the store again, not start them empty: an empty
// chat's next reply would save over the stored history.
test.describe("after the tab releases idle chats", () => {
	const OTHER_CHATS = 9;

	/**
	 * A chat's sidebar entry, once it's saved and named after its first message. Until then it's
	 * "New chat" (a workspace's "New chat, 2 panes"), which the New chat link would also match.
	 */
	const savedEntry = (page: Page, title: string) =>
		page
			.getByRole("list", { name: "Recent chats" })
			.getByRole("link", { name: new RegExp(`^${title}`) });

	async function openOtherChats(page: Page) {
		const body = page.locator("body");
		for (let i = 0; i < OTHER_CHATS; i++) {
			await page.getByRole("link", { name: "New chat", exact: true }).click();
			await expect(page).toHaveURL(/\/new$/);
			await composer(body).fill(`Other ${i}`);
			await composer(body).press("Enter");
			await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
			await expect(status(body)).toHaveAttribute("data-chat-status", "ready");
			// Marked active once the chat's own page shows. Until then `/new` is still on screen with
			// this chat, and clicking New chat right away would keep it there, so the next message would
			// go into it.
			await expect(savedEntry(page, `Other ${i}`)).toHaveAttribute(
				"data-active",
			);
		}
	}

	test("a workspace's panes keep their history", async ({ page, context }) => {
		test.setTimeout(90_000);
		await setUp(context, page, e2eMockModel("alpha"));
		await openWorkspace(page, 2);
		const workspaceUrl = page.url();
		await composer(pane(page, 1)).fill("Remember me");
		await composer(pane(page, 1)).press("Enter");
		for (const n of [1, 2]) {
			await expect(status(pane(page, n))).toHaveAttribute(
				"data-chat-status",
				"ready",
			);
		}

		await expect(savedEntry(page, "Remember me")).toHaveAttribute(
			"data-active",
		);
		await openOtherChats(page);
		await savedEntry(page, "Remember me").click();
		await expect(page).toHaveURL(workspaceUrl);
		for (const n of [1, 2]) {
			await expect(pane(page, n).getByText("Remember me")).toBeVisible();
		}

		// The next reply adds to the history instead of replacing it, and both survive a reload.
		await composer(pane(page, 1)).fill("After return");
		await composer(pane(page, 1)).press("Enter");
		for (const n of [1, 2]) {
			const chatId = await pane(page, n).getAttribute("data-pane-id");
			await expect.poll(() => savedMessages(page, chatId ?? "")).toBe(4);
		}
		await page.reload();
		await expect(panes(page)).toHaveCount(2);
		for (const n of [1, 2]) {
			await expect(pane(page, n).getByText("Remember me")).toBeVisible();
			await expect(pane(page, n).getByText("After return")).toBeVisible();
		}
	});

	test("a single chat keeps its history", async ({ page, context }) => {
		test.setTimeout(90_000);
		await setUp(context, page, e2eMockModel("alpha"));
		await page.goto("/new");
		const body = page.locator("body");
		await composer(body).fill("Remember me");
		await composer(body).press("Enter");
		await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
		const chatUrl = page.url();
		await expect(status(body)).toHaveAttribute("data-chat-status", "ready");

		await expect(savedEntry(page, "Remember me")).toHaveAttribute(
			"data-active",
		);
		await openOtherChats(page);
		await savedEntry(page, "Remember me").click();
		await expect(page).toHaveURL(chatUrl);
		await expect(page.getByText("Remember me").last()).toBeVisible();

		await composer(body).fill("After return");
		await composer(body).press("Enter");
		const chatId = new URL(chatUrl).pathname.slice(1);
		await expect.poll(() => savedMessages(page, chatId)).toBe(4);
		await page.reload();
		await expect(page.getByText(e2eMockReply("alpha"))).toHaveCount(2);
		await expect(page.locator("main").getByText("Remember me")).toBeVisible();
	});
});
