import type { BrowserContext, Page } from "@playwright/test";
import { E2E_MOCK_MODEL, E2E_MOCK_REPLY } from "../src/lib/chat/e2e-model";
import { expect, test } from "./support/fixtures";

// Roadmap 2.3: local endpoints in Settings, Chrome's Local Network Access explainer and denial help,
// the CORS check, and a chat through a saved endpoint. The local server is stubbed with `context.route`
// (which also sees the CORS check's worker); it lists the e2e mock model, so the chat itself runs on
// MockLanguageModelV4 and never reaches a real model.

const STUB_BASE = "http://127.0.0.1:5577/v1";
const STUB_NAME = "Stub server";

type CorsMode = "any-site" | "this-site";

/** A local server at STUB_BASE that allows every origin (`*`) or only the app's own. */
async function stubLocalServer(
	context: BrowserContext,
	appOrigin: string,
	mode: CorsMode,
) {
	const seen: string[] = [];
	await context.route(`${STUB_BASE}/**`, async (route) => {
		const request = route.request();
		const origin = (await request.allHeaders()).origin ?? "";
		seen.push(
			`${request.method()} ${new URL(request.url()).pathname} ${origin}`,
		);
		// Always set: route.fulfill adds a matching header itself when there's none, which would
		// let every origin in.
		const headers = {
			"access-control-allow-origin": mode === "any-site" ? "*" : appOrigin,
			vary: "Origin",
		};
		if (request.method() === "OPTIONS") {
			return route.fulfill({ status: 204, headers });
		}
		return route.fulfill({
			headers,
			json: {
				object: "list",
				data: [{ id: E2E_MOCK_MODEL }, { id: "qwen3-8b" }],
			},
		});
	});
	return seen;
}

/** Answers the Local Network Access permission query the way Chrome would. */
async function networkAccessIs(page: Page, state: PermissionState) {
	await page.addInitScript((answer) => {
		const query = navigator.permissions.query.bind(navigator.permissions);
		navigator.permissions.query = ((descriptor: { name: string }) =>
			/network/.test(descriptor.name)
				? Promise.resolve({ state: answer } as PermissionStatus)
				: query(descriptor as PermissionDescriptor)) as Permissions["query"];
	}, state);
}

async function addStubEndpoint(page: Page) {
	await page.goto("/settings");
	const section = page.getByRole("region", { name: "Local models" });
	await section.getByRole("button", { name: "Add local server" }).click();
	await section
		.getByRole("radio", { name: "Other OpenAI-compatible server" })
		.check();
	await section.getByLabel("Name").fill(STUB_NAME);
	await section.getByLabel("Base URL").fill(`${STUB_BASE}/`);
	await section.getByRole("button", { name: "Add server" }).click();
	const row = section.getByRole("region", { name: STUB_NAME });
	await expect(row).toContainText(STUB_BASE);
	return row;
}

test("add a server, test it, see the * warning, dismiss it, and chat through it", async ({
	page,
	context,
	baseURL,
}) => {
	const appOrigin = new URL(baseURL ?? "").origin;
	const seen = await stubLocalServer(context, appOrigin, "any-site");
	await networkAccessIs(page, "prompt");

	const row = await addStubEndpoint(page);
	// Saving calls nothing; only "Test connection" does, after the explainer.
	expect(seen).toEqual([]);
	await row.getByRole("button", { name: "Test connection" }).click();
	const explainer = row.getByRole("note", {
		name: "Before connecting to your computer",
	});
	await expect(explainer).toContainText("choose Allow");
	expect(seen).toEqual([]);
	await explainer.getByRole("button", { name: "Continue" }).click();

	await expect(row).toContainText("Connected · 2 models");
	await expect(
		row
			.getByRole("list", { name: "Models on this server" })
			.getByRole("listitem"),
	).toHaveText([E2E_MOCK_MODEL, "qwen3-8b"]);
	const warning = row.getByRole("alert", {
		name: "Every website can use this server",
	});
	await expect(warning).toContainText(`OLLAMA_ORIGINS=${appOrigin}`);
	await warning
		.getByRole("button", { name: `Don't show again for ${STUB_NAME}` })
		.click();
	await expect(warning).toHaveCount(0);

	// Testing again doesn't bring it back, and the explainer isn't shown twice.
	await row.getByRole("button", { name: "Test connection" }).click();
	await expect(row).toContainText("Connected · 2 models");
	await expect(warning).toHaveCount(0);
	await expect(explainer).toHaveCount(0);

	// The picker's Local group lists what the server reports.
	await page.goto("/new");
	await page.getByRole("button", { name: /^Model: / }).click();
	const local = page
		.getByRole("dialog", { name: "Choose a model" })
		.getByRole("region", { name: "Local" });
	await expect(local.getByRole("button")).toHaveText([
		new RegExp(`${E2E_MOCK_MODEL}${STUB_NAME}$`),
		new RegExp(`qwen3-8b${STUB_NAME}$`),
	]);
	await local.getByRole("button", { name: E2E_MOCK_MODEL }).click();
	await expect(page.getByText(`via ${STUB_NAME}`)).toBeVisible();
	await expect(
		page.getByRole("article", { name: `About ${E2E_MOCK_MODEL}` }),
	).toContainText(`served by ${STUB_NAME} at 127.0.0.1:5577`);

	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hello local model");
	await box.press("Enter");
	await expect(page.getByText(E2E_MOCK_REPLY.join(""))).toBeVisible();
	await expect(page.getByText(`via ${STUB_NAME}`)).toBeVisible();
});

test("a server that allows only this site gets a green check", async ({
	page,
	context,
	baseURL,
}) => {
	const appOrigin = new URL(baseURL ?? "").origin;
	const seen = await stubLocalServer(context, appOrigin, "this-site");
	await networkAccessIs(page, "granted");

	const row = await addStubEndpoint(page);
	await row.getByRole("button", { name: "Test connection" }).click();
	await row.getByRole("button", { name: "Continue" }).click();
	await expect(row).toContainText("Only this site can use this server.");
	await expect(row.getByRole("alert")).toHaveCount(0);
	// The check asked once as this site and once as an opaque origin.
	expect(seen).toContain(`GET /v1/models ${appOrigin}`);
	expect(seen).toContain("GET /v1/models null");
});

test("a denied Local Network Access permission shows how to re-allow it", async ({
	page,
	context,
}) => {
	await context.route(`${STUB_BASE}/**`, (route) =>
		route.abort("accessdenied"),
	);
	await networkAccessIs(page, "denied");

	const row = await addStubEndpoint(page);
	await row.getByRole("button", { name: "Test connection" }).click();
	await row.getByRole("button", { name: "Continue" }).click();
	const help = row.getByRole("alert", {
		name: "Local network access is blocked",
	});
	await expect(help).toContainText("Chrome won't ask again");
	await expect(help).toContainText("Site settings");

	await page.goto("/new");
	await page.getByRole("button", { name: /^Model: / }).click();
	await expect(
		page
			.getByRole("dialog", { name: "Choose a model" })
			.getByRole("region", { name: "Local" }),
	).toContainText("Allow local network access in this site's settings");
});

test("no local server is called on page load, and a LAN address can't be saved", async ({
	page,
	context,
}) => {
	const seen = await stubLocalServer(context, "", "any-site");
	await addStubEndpoint(page);
	await page.goto("/new");
	await page.reload();
	await expect(page.getByRole("button", { name: /^Model: / })).toBeVisible();
	expect(seen).toEqual([]);

	await page.goto("/settings");
	const section = page.getByRole("region", { name: "Local models" });
	await section.getByRole("button", { name: "Add local server" }).click();
	await section.getByLabel("Base URL").fill("http://192.168.1.20:1234/v1");
	await section.getByRole("button", { name: "Add server" }).click();
	await expect(section).toContainText("Only localhost and 127.0.0.1 work.");
	await expect(section.getByRole("region")).toHaveCount(1);
});

test("the picker's Local view lists only local models, by keyboard, and is remembered", async ({
	page,
	context,
	baseURL,
}) => {
	await stubLocalServer(context, new URL(baseURL ?? "").origin, "this-site");
	await networkAccessIs(page, "granted");
	await addStubEndpoint(page);

	await page.goto("/new");
	await page.getByRole("button", { name: /^Model: / }).click();
	const dialog = page.getByRole("dialog", { name: "Choose a model" });
	const views = dialog.getByRole("group", { name: "Which models" });
	await expect(views.getByRole("button")).toHaveText([
		"High Elo",
		"All models",
		"Local",
	]);
	await views.getByRole("button", { name: "All models" }).focus();
	await page.keyboard.press("Tab");
	await expect(views.getByRole("button", { name: "Local" })).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(views.getByRole("button", { name: "Local" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(dialog.getByRole("region", { name: "Models" })).toHaveCount(0);
	await expect(
		dialog.getByRole("region", { name: "Use a model id" }),
	).toHaveCount(0);
	await expect(dialog.getByLabel("Developer")).toHaveCount(0);
	const local = dialog.getByRole("region", { name: "Local" });
	await local.getByRole("button", { name: "Continue" }).click();
	await expect(local.getByRole("button")).toHaveText([
		new RegExp(`${E2E_MOCK_MODEL}${STUB_NAME}$`),
		new RegExp(`qwen3-8b${STUB_NAME}$`),
	]);
	// Search still narrows the list.
	await dialog.getByLabel("Search models").fill("qwen");
	await expect(local.getByRole("button")).toHaveText([
		new RegExp(`qwen3-8b${STUB_NAME}$`),
	]);

	// Kept in this browser.
	await page.reload();
	await page.getByRole("button", { name: /^Model: / }).click();
	await expect(views.getByRole("button", { name: "Local" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(dialog.getByRole("region", { name: "Local" })).toBeVisible();
});
