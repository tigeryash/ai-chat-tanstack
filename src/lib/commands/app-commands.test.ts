import { describe, expect, it } from "vitest";
import { sanitizeEvent } from "@/lib/analytics/track";
import { withPreset } from "@/lib/appearance/presets";
import { DEFAULT_APPEARANCE } from "@/lib/appearance/schema";
import {
	ACTION_COMMANDS,
	switchThemeCommand,
	toggleCommands,
} from "./app-commands";

const state = { theme: "dark", density: "compact", analytics: true } as const;

describe("app commands", () => {
	it("all have ids command_run accepts", () => {
		for (const command of [...ACTION_COMMANDS, ...toggleCommands(state)]) {
			expect(sanitizeEvent("command_run", { id: command.id })).not.toBeNull();
		}
	});

	it("command_run takes no chat id or title", () => {
		expect(sanitizeEvent("command_run", { id: "chat:1234-abcd" })).toBeNull();
		expect(sanitizeEvent("command_run", { id: "Plans for Q3" })).toBeNull();
		expect(sanitizeEvent("palette_opened", { query: "secret" })).toEqual({
			name: "palette_opened",
			properties: {},
		});
	});

	it("marks the current theme and density, and hides analytics when the browser opts out", () => {
		const toggles = toggleCommands(state);
		const checked = toggles.filter((t) => t.checked).map((t) => t.id);
		expect(checked).toEqual([
			"theme-dark",
			"density-compact",
			"toggle-analytics",
		]);
		expect(
			toggleCommands({ ...state, analytics: null }).some(
				(t) => t.id === "toggle-analytics",
			),
		).toBe(false);
	});

	it("lists the presets on Switch theme, checked until the preset is edited", () => {
		const paper = withPreset(DEFAULT_APPEARANCE, "paper");
		const page = (settings: typeof paper) =>
			switchThemeCommand(settings).opens?.commands() ?? [];
		const rows = page(paper);
		expect(rows.map((r) => r.id)).toEqual([
			"theme-system",
			"theme-light",
			"theme-dark",
			"preset-default",
			"preset-high-contrast",
			"preset-brand",
			"preset-paper",
			"preset-nord",
			"preset-dracula",
		]);
		for (const row of rows) {
			expect(sanitizeEvent("command_run", { id: row.id })).not.toBeNull();
		}
		expect(rows.filter((r) => r.checked).map((r) => r.id)).toEqual([
			"theme-system",
			"preset-paper",
		]);
		const edited = { ...paper, radius: "sharp" as const };
		expect(
			page(edited).some((r) => r.id.startsWith("preset-") && r.checked),
		).toBe(false);
		expect(switchThemeCommand(edited).detail).toBe(
			"System · Custom (from Paper)",
		);
	});
});
