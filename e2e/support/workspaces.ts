import type { BrowserContext, Locator, Page } from "@playwright/test";
import { E2E_SLOW_MODEL, e2eMockModel } from "../../src/lib/chat/e2e-model";
import { MODEL_CHOICE_STORAGE_KEY } from "../../src/lib/chat/model-selection";
import { LOCAL_ENDPOINTS_STORAGE_KEY } from "../../src/lib/local-endpoints/endpoints";
import { expect } from "./fixtures";

// Shared by the workspace specs: a stubbed local server listing e2e mock models, so every reply comes
// from MockLanguageModelV4 (hard rule 6), and helpers for panes.

export const STUB_BASE = "http://127.0.0.1:5577/v1";
export const STUB = {
	id: "stub",
	kind: "custom",
	name: "Stub server",
	baseUrl: STUB_BASE,
};
export const MODELS = ["alpha", "beta", "gamma"] as const;

/** A saved local server listing the mock models, with its first model picked for new chats. */
export async function setUp(
	context: BrowserContext,
	page: Page,
	model: string,
) {
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

export const pane = (page: Page, n: number) =>
	page.getByRole("region", { name: `Pane ${n}`, exact: true });
export const panes = (page: Page) => page.locator("section[data-pane-id]");
export const composer = (scope: Locator) =>
	scope.getByPlaceholder("Ask anything");
export const status = (scope: Locator) => scope.locator("[data-chat-status]");

export async function pickModel(scope: Locator, page: Page, model: string) {
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
export async function openWorkspace(page: Page, count: number) {
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

/** A row of the app's IndexedDB (`highelo-chats`), as stored; undefined until it's written. */
export const storedRow = <Row>(
	page: Page,
	table: "chats" | "workspaces",
	id: string,
) =>
	page.evaluate(
		async ([name, key]) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const open = indexedDB.open("highelo-chats");
				open.onsuccess = () => resolve(open.result);
				open.onerror = () => reject(open.error);
			});
			const row = await new Promise<unknown>((resolve, reject) => {
				const request = db.transaction(name).objectStore(name).get(key);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			db.close();
			return row as Row | undefined;
		},
		[table, id] as const,
	);

/**
 * How many messages the chat has saved in this browser (0 before its first save). A pane's
 * `data-chat-status="ready"` isn't enough before leaving the page: the AI SDK reports "ready" before
 * the reply's `onFinish` save runs.
 */
export const savedMessages = async (page: Page, chatId: string) =>
	(await storedRow<{ messageCount?: number }>(page, "chats", chatId))
		?.messageCount ?? 0;
