import type { BrowserContext, Locator, Page } from "@playwright/test";
import {
	E2E_SLOW_MODEL,
	e2eMockModel,
	e2eMockReply,
} from "../src/lib/chat/e2e-model";
import { MODEL_CHOICE_STORAGE_KEY } from "../src/lib/chat/model-selection";
import { LOCAL_ENDPOINTS_STORAGE_KEY } from "../src/lib/local-endpoints/endpoints";
import { expect, test } from "./support/fixtures";

// Roadmaps 3.1 and 3.2: panes side by side, each with its own model, synced composers, Stop, the
// "Diverged" badge, and a workspace that survives a reload. The models are e2e mock models listed by a
// stubbed local server, so every reply comes from MockLanguageModelV4 (hard rule 6).

const STUB_BASE = "http://127.0.0.1:5577/v1";
const STUB = {
	id: "stub",
	kind: "custom",
	name: "Stub server",
	baseUrl: STUB_BASE,
};
const MODELS = ["alpha", "beta", "gamma"] as const;

/** A saved local server listing the mock models, with its first model picked for new chats. */
async function setUp(context: BrowserContext, page: Page, model: string) {
	await context.route(`${STUB_BASE}/**`, (route) =>
		route.fulfill({
			headers: { "access-control-allow-origin": "*" },
			json: {
				object: "list",
				data: [...MODELS.map(e2eMockModel), E2E_SLOW_MODEL].map((id) => ({
					id,
				})),
			},
		}),
	);
	await page.addInitScript(
		([endpointsKey, endpoint, choiceKey, choice]) => {
			if (sessionStorage.getItem("seeded")) return;
			sessionStorage.setItem("seeded", "1");
			localStorage.setItem(endpointsKey, JSON.stringify([endpoint]));
			localStorage.setItem("highelo-local-network-explained", "true");
			localStorage.setItem(choiceKey, JSON.stringify(choice));
		},
		[
			LOCAL_ENDPOINTS_STORAGE_KEY,
			STUB,
			MODEL_CHOICE_STORAGE_KEY,
			{ provider: "local", model, endpoint: STUB.id },
		] as const,
	);
}

const pane = (page: Page, n: number) =>
	page.getByRole("region", { name: `Pane ${n}`, exact: true });
const panes = (page: Page) => page.locator("section[data-pane-id]");
const composer = (scope: Locator) => scope.getByPlaceholder("Ask anything");
const status = (scope: Locator) => scope.locator("[data-chat-status]");

async function pickModel(scope: Locator, page: Page, model: string) {
	await scope.getByRole("button", { name: /^Model: / }).click();
	const picker = page.getByRole("dialog", { name: "Choose a model" });
	await picker
		.getByRole("region", { name: "Local" })
		.getByRole("button", { name: model, exact: true })
		.click();
	await expect(picker).toHaveCount(0);
	await expect(scope.getByRole("button", { name: /^Model: / })).toContainText(
		model,
	);
}

/** From `/new`: a workspace with `count` panes. */
async function openWorkspace(page: Page, count: number) {
	await page.goto("/new");
	await page.getByRole("button", { name: "Add pane" }).click();
	await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
	await expect(panes(page)).toHaveCount(2);
	for (let n = 3; n <= count; n++) {
		await page.getByRole("button", { name: "Add pane" }).click();
		await expect(panes(page)).toHaveCount(n);
	}
	await expect(panes(page)).toHaveCount(count);
}

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

test.describe("on a narrow screen", () => {
	test.use({ viewport: { width: 600, height: 800 } });

	test("one pane shows at a time, with a switcher", async ({
		page,
		context,
	}) => {
		await setUp(context, page, e2eMockModel("alpha"));
		await openWorkspace(page, 2);
		const tabs = page.getByRole("tablist", { name: "Panes" }).getByRole("tab");
		await expect(tabs).toHaveText(["Pane 1", "Pane 2"]);
		await expect(pane(page, 1)).toBeVisible();
		await expect(pane(page, 2)).toBeHidden();

		// A synced send also reaches the hidden pane.
		await composer(pane(page, 1)).fill("Hi both");
		await composer(pane(page, 1)).press("Enter");
		await expect(pane(page, 1).getByText(e2eMockReply("alpha"))).toBeVisible();
		await tabs.last().click();
		await expect(pane(page, 1)).toBeHidden();
		await expect(pane(page, 2).getByText(e2eMockReply("alpha"))).toBeVisible();

		// Adding a pane shows it.
		await page.getByRole("button", { name: "Add pane" }).click();
		await expect(tabs).toHaveCount(3);
		await expect(pane(page, 3)).toBeVisible();
		await expect(pane(page, 2)).toBeHidden();
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
	await expect(
		page.locator("main, [data-slot=sidebar-inset]").first(),
	).toHaveScreenshot("workspace-three-panes.png");
});

// Quality audit Q2, W1: the tab keeps at most 8 idle chats open, so opening 9 others releases the ones
// shown before. Coming back has to read them from the store again, not start them empty: an empty
// chat's next reply would save over the stored history.
test.describe("after the tab releases idle chats", () => {
	const OTHER_CHATS = 9;

	async function openOtherChats(page: Page) {
		const body = page.locator("body");
		for (let i = 0; i < OTHER_CHATS; i++) {
			await page.getByRole("link", { name: "New chat" }).click();
			await expect(page).toHaveURL(/\/new$/);
			await composer(body).fill(`Other ${i}`);
			await composer(body).press("Enter");
			await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
			await expect(status(body)).toHaveAttribute("data-chat-status", "ready");
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

		await openOtherChats(page);
		await page.getByRole("link", { name: /Remember me/ }).click();
		await expect(page).toHaveURL(workspaceUrl);
		for (const n of [1, 2]) {
			await expect(pane(page, n).getByText("Remember me")).toBeVisible();
		}

		// The next reply adds to the history instead of replacing it, and both survive a reload.
		await composer(pane(page, 1)).fill("After return");
		await composer(pane(page, 1)).press("Enter");
		for (const n of [1, 2]) {
			await expect(status(pane(page, n))).toHaveAttribute(
				"data-chat-status",
				"ready",
			);
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

		await openOtherChats(page);
		await page.getByRole("link", { name: /Remember me/ }).click();
		await expect(page).toHaveURL(chatUrl);
		await expect(page.getByText("Remember me").last()).toBeVisible();

		await composer(body).fill("After return");
		await composer(body).press("Enter");
		await expect(status(body)).toHaveAttribute("data-chat-status", "ready");
		await page.reload();
		await expect(page.getByText(e2eMockReply("alpha"))).toHaveCount(2);
		await expect(page.locator("main").getByText("Remember me")).toBeVisible();
	});
});
