import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Roadmap 1.2: a real chat through OpenRouter (/e2e/chat-live: picker, transport, provider), with
// OpenRouter faked. Records everything the page sends anywhere, and checks the key only went to
// OpenRouter.

const OPENROUTER_KEY = "sk-or-v1-e2eFakeChatKey0123456789cafe";
const MODEL = "google/gemma-4-26b-a4b-it:free";

const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};

function sse(deltas: object[]): string {
	const chunk = (delta: object, finish: string | null = null) =>
		`data: ${JSON.stringify({
			id: "gen-1",
			object: "chat.completion.chunk",
			created: 1,
			model: MODEL,
			choices: [{ index: 0, delta, finish_reason: finish }],
		})}\n\n`;
	return `${deltas.map((delta) => chunk(delta)).join("")}${chunk({}, "stop")}data: [DONE]\n\n`;
}

async function fakeOpenRouter(page: Page) {
	const sent: Promise<{ origin: string; text: string }>[] = [];
	const completions: unknown[] = [];
	page.on("request", (request: Request) => {
		sent.push(
			request.allHeaders().then((headers) => ({
				origin: new URL(request.url()).origin,
				text: [
					request.url(),
					JSON.stringify(headers),
					request.postData() ?? "",
				].join("\n"),
			})),
		);
	});
	await page.route("https://openrouter.ai/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (request.method() === "OPTIONS") {
			return route.fulfill({ status: 204, headers: CORS_HEADERS });
		}
		if (url.pathname === "/api/v1/models") {
			return route.fulfill({
				headers: CORS_HEADERS,
				json: { data: [{ id: MODEL }, { id: "openai/gpt-oss-20b:free" }] },
			});
		}
		if (url.pathname === "/api/v1/chat/completions") {
			completions.push(request.postDataJSON());
			return route.fulfill({
				headers: { ...CORS_HEADERS, "content-type": "text/event-stream" },
				body: sse([
					{ role: "assistant", reasoning: "Considering a greeting." },
					{ content: "Hello from " },
					{ content: "OpenRouter!" },
				]),
			});
		}
		return route.fulfill({ status: 404, headers: CORS_HEADERS });
	});
	return {
		completions,
		async originsThatReceived(secret: string) {
			const all = await Promise.all(sent);
			return [
				...new Set(
					all.filter((s) => s.text.includes(secret)).map((s) => s.origin),
				),
			];
		},
	};
}

test("a chat through OpenRouter sends the key only to OpenRouter", async ({
	page,
}) => {
	const openRouter = await fakeOpenRouter(page);

	// Save the key the way a person would, remembered on this device.
	await page.goto("/e2e/keys");
	const row = page.getByRole("region", { name: "OpenRouter", exact: true });
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel("OpenRouter API key").fill(OPENROUTER_KEY);
	await row.getByRole("radio", { name: "Remember on this device" }).check();
	await row.getByRole("button", { name: "Save key" }).click();
	await expect(row).toContainText("••••cafe");

	// The model isn't in the catalog, so it goes in as a typed model id.
	await page.goto("/e2e/chat-live");
	await page.getByRole("button", { name: /^Model: / }).click();
	const picker = page.getByRole("dialog", { name: "Choose a model" });
	await picker.getByLabel("Search models").fill(MODEL);
	await picker
		.getByRole("button", { name: `Use “${MODEL}” via OpenRouter` })
		.click();
	await expect(
		page.getByRole("button", { name: `Model: ${MODEL}` }),
	).toBeVisible();

	const box = page.getByPlaceholder("Ask anything");
	await box.fill("Hi there");
	await box.press("Enter");

	await expect(page.getByText("Hello from OpenRouter!")).toBeVisible();
	await expect(page.getByText("Considering a greeting.")).toBeAttached();
	await expect(page.getByText(`${MODEL} · OpenRouter`)).toBeVisible();

	expect(openRouter.completions).toEqual([
		expect.objectContaining({
			model: MODEL,
			stream: true,
			messages: [{ role: "user", content: "Hi there" }],
		}),
	]);
	expect(await openRouter.originsThatReceived(OPENROUTER_KEY)).toEqual([
		"https://openrouter.ai",
	]);
});

test("with nothing connected, the picker links to Settings", async ({
	page,
}) => {
	await page.goto("/e2e/chat-live");
	await expect(page.getByText("Pick a model to start.")).toBeVisible();
	await page.getByRole("button", { name: "Model: Pick a model" }).click();
	await expect(
		page
			.getByRole("dialog", { name: "Choose a model" })
			.getByRole("link", { name: "Connect Anthropic" })
			.first(),
	).toHaveAttribute("href", "/settings");
});
