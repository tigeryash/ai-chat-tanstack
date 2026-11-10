import { describe, expect, it } from "vitest";
import { sanitizeEvent } from "@/lib/analytics/track";
import { ACTION_COMMANDS, toggleCommands } from "./app-commands";

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
});
