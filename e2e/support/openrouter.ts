import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

// A faked OpenRouter for the attachment specs: a saved key, a chat completions endpoint that records each
// request and streams a fixed reply, and the seeded catalog's models picked by search.

const KEY = "sk-or-v1-e2eFakeAttachKey0123456789ab";
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};
// A 4×4 red PNG.
export const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8CAB+GTG8HSALfKY52fTcuYAAAAAElFTkSuQmCC",
	"base64",
);

function sse(text: string): string {
	const base = { id: "gen-1", object: "chat.completion.chunk", created: 1 };
	const chunks = [
		{
			...base,
			choices: [{ index: 0, delta: { role: "assistant", content: text } }],
		},
		{ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
	];
	return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
}

export async function fakeOpenRouter(page: Page) {
	const completions: {
		model: string;
		messages: { role: string; content: unknown }[];
	}[] = [];
	await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
		const request = route.request();
		if (request.method() === "OPTIONS") {
			return route.fulfill({ status: 204, headers: CORS_HEADERS });
		}
		completions.push(request.postDataJSON());
		return route.fulfill({
			headers: { ...CORS_HEADERS, "content-type": "text/event-stream" },
			body: sse("A red square."),
		});
	});
	return completions;
}

export async function connectOpenRouter(page: Page) {
	await page.goto("/e2e/keys");
	const row = page.getByRole("region", { name: "OpenRouter", exact: true });
	await row.getByRole("button", { name: "Add key" }).click();
	await row.getByLabel("OpenRouter API key").fill(KEY);
	await row.getByRole("radio", { name: "Remember on this device" }).check();
	await row.getByRole("button", { name: "Save key" }).click();
	await expect(row).toContainText(`••••${KEY.slice(-4)}`);
}

export async function pickModel(page: Page, search: string, gatewayId: string) {
	await page.getByRole("button", { name: /^Model: / }).click();
	const dialog = page.getByRole("dialog", { name: "Choose a model" });
	await dialog.getByRole("button", { name: "All models" }).click();
	await dialog.getByLabel("Search models").fill(search);
	await dialog
		.locator(`li[data-model="${gatewayId}"]`)
		.getByRole("button")
		.click();
	await expect(dialog).toBeHidden();
}
