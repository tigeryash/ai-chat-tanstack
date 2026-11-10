import type { Page } from "@playwright/test";

/** The Settings dialog (roadmap R2 S1). */
export function settingsDialog(page: Page) {
	return page.getByRole("dialog", { name: /^Settings/ });
}

/** Switches the open Settings dialog to a section through its nav. */
export async function showSettingsSection(page: Page, name: string) {
	await settingsDialog(page)
		.getByRole("navigation", { name: "Settings sections" })
		.getByRole("button", { name, exact: true })
		.click();
}
