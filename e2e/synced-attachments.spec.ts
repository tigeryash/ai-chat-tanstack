import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { connectOpenRouter, fakeOpenRouter, PNG } from "./support/openrouter";

// Roadmap 3.3 (decision 17) on two synced panes: DeepSeek V4.1 Flash (text only) on the left, Claude Opus
// 5.5 (reads images) on the right, as in Yash's report. Files attached in one synced composer show in both,
// the pane whose model can't read one says so and gets an amber border, each pane's request carries only
// what its model reads, "Skip this pane" leaves it out of the send, and a send empties both composers.

const pane = (page: Page, n: number) =>
	page.getByRole("region", { name: `Pane ${n}`, exact: true });
const card = (scope: Locator) => scope.locator("[data-chat-status]");
const note = (scope: Locator) =>
	scope.getByRole("radiogroup", { name: "Attachments this model can't read" });
const chip = (scope: Locator, name: string) =>
	scope.getByRole("button", { name: `Remove ${name}` });
const files = [
	{ name: "red.png", mimeType: "image/png", buffer: PNG },
	{
		name: "notes.md",
		mimeType: "text/markdown",
		buffer: Buffer.from("# Notes\n"),
	},
];

async function openSyncedPanes(page: Page) {
	const completions = await fakeOpenRouter(page);
	await connectOpenRouter(page);
	await page.goto(
		"/new?models=deepseek/deepseek-v4.1-flash,anthropic/claude-opus-5.5",
	);
	const text = pane(page, 1);
	const vision = pane(page, 2);
	await expect(vision.getByRole("button", { name: /^Model: / })).toContainText(
		"Opus",
	);
	const userContent = (model: RegExp) =>
		completions
			.filter((c) => model.test(c.model))
			.map((c) => c.messages.filter((m) => m.role === "user").at(-1)?.content);
	return { completions, text, vision, userContent };
}

/** The pane card's border colour, and the warning token's, resolved for the current theme. */
async function borderColors(scope: Locator) {
	return card(scope).evaluate((element) => {
		const probe = document.createElement("div");
		probe.className = "border border-warning";
		document.body.append(probe);
		const warning = getComputedStyle(probe).borderTopColor;
		probe.remove();
		return { border: getComputedStyle(element).borderTopColor, warning };
	});
}

test("files attached in one synced composer show in both, and a send empties both", async ({
	page,
}) => {
	const { text, vision, userContent } = await openSyncedPanes(page);

	await text.locator("input[type=file]").setInputFiles(files);
	// Mirrored: the other synced composer shows the same chips.
	for (const scope of [text, vision]) {
		await expect(chip(scope, "red.png")).toBeAttached();
		await expect(chip(scope, "notes.md")).toBeAttached();
	}
	// Only the text-only pane warns, in its note and with an amber border.
	await expect(note(text)).toHaveAccessibleDescription(
		"This model can't read red.png, so this pane gets the message without it.",
	);
	await expect(note(vision)).toHaveCount(0);
	await expect(card(text)).toHaveAttribute("data-unreadable-attachments", "");
	await expect(card(vision)).not.toHaveAttribute("data-unreadable-attachments");
	await expect
		.poll(async () => {
			const { border, warning } = await borderColors(text);
			return border === warning;
		})
		.toBe(true);
	const plain = await borderColors(vision);
	expect(plain.border).not.toBe(plain.warning);

	// Removing a chip in either composer removes it everywhere.
	await chip(vision, "notes.md").dispatchEvent("click");
	for (const scope of [text, vision]) {
		await expect(chip(scope, "notes.md")).toHaveCount(0);
	}
	await text
		.locator("input[type=file]")
		.setInputFiles([files[1] as (typeof files)[number]]);
	await expect(chip(vision, "notes.md")).toBeAttached();

	// The default choice, text only, sent with Enter from the text-only pane's composer.
	await expect(
		note(text).getByRole("radio", { name: "Send text only" }),
	).toBeChecked();
	const box = text.getByPlaceholder("Ask anything");
	await box.fill("What colour is this?");
	await box.press("Enter");
	await expect(text.getByText("A red square.")).toBeVisible();
	await expect(vision.getByText("A red square.")).toBeVisible();

	// Both composers let go of the files, and the warning goes with them.
	for (const scope of [text, vision]) {
		await expect(chip(scope, "red.png")).toHaveCount(0);
		await expect(chip(scope, "notes.md")).toHaveCount(0);
		await expect(scope.getByPlaceholder("Ask anything")).toHaveValue("");
	}
	await expect(note(text)).toHaveCount(0);
	await expect(card(text)).not.toHaveAttribute("data-unreadable-attachments");
	await expect
		.poll(async () => {
			const { border, warning } = await borderColors(text);
			return border === warning;
		})
		.toBe(false);

	const notesPart = {
		type: "text",
		text: expect.stringContaining("File: notes.md"),
	};
	const prompt = { type: "text", text: "What colour is this?" };
	expect(userContent(/opus/)).toEqual([
		[
			{
				type: "image_url",
				image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) },
			},
			notesPart,
			prompt,
		],
	]);
	expect(userContent(/deepseek/)).toEqual([[notesPart, prompt]]);
});

test("Skip this pane, chosen with the keyboard, keeps that pane out of an Enter send from the other composer", async ({
	page,
}) => {
	const { completions, text, vision } = await openSyncedPanes(page);

	// Attached in the left composer, sent with Enter from the right one: the files go with it either way.
	await text
		.locator("input[type=file]")
		.setInputFiles([files[0] as (typeof files)[number]]);
	const textOnly = note(text).getByRole("radio", { name: "Send text only" });
	const skip = note(text).getByRole("radio", { name: "Skip this pane" });
	await expect(textOnly).toBeChecked();
	await expect(skip).not.toBeChecked();
	// Arrow keys move the choice, as in any radio group.
	await textOnly.focus();
	await page.keyboard.press("ArrowRight");
	await expect(skip).toBeChecked();
	await expect(skip).toBeFocused();
	await expect(textOnly).not.toBeChecked();
	await expect(note(text)).toHaveAccessibleDescription(
		"This model can't read red.png, so this pane won't get the message.",
	);

	// The choice holds while the draft is typed, until the send.
	const box = vision.getByPlaceholder("Ask anything");
	await box.fill("Describe this");
	await expect(skip).toBeChecked();
	await box.press("Enter");
	await expect(vision.getByText("A red square.")).toBeVisible();
	await expect.poll(() => completions.length).toBe(1);
	expect(completions[0]?.model).toMatch(/opus/);
	await expect(text.getByText("Describe this")).toHaveCount(0);
	for (const scope of [text, vision]) {
		await expect(chip(scope, "red.png")).toHaveCount(0);
	}

	// The next attachment asks afresh: text only again.
	await vision
		.locator("input[type=file]")
		.setInputFiles([files[0] as (typeof files)[number]]);
	await expect(
		note(text).getByRole("radio", { name: "Send text only" }),
	).toBeChecked();
});
