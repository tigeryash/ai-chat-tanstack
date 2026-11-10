import { describe, expect, it, vi } from "vitest";
import { sidebarEntries } from "@/lib/workspaces/sidebar-entries";
import { analyticsIdOf, type CommandEnv, isRememberable } from "./command";
import {
	chatCommands,
	layoutCommands,
	settingsCommands,
} from "./data-commands";

const chat = (id: string, ownerId: string | null, updatedAt: number) => ({
	id,
	title: `Title ${id}`,
	createdAt: 0,
	updatedAt,
	messageCount: 2,
	pinned: false,
	ownerId,
});

const env = (): CommandEnv => ({
	goTo: vi.fn(),
	openChat: vi.fn(),
	openWorkspace: vi.fn(),
	openLayout: vi.fn(),
	openSettings: vi.fn(),
	toggleSidebar: vi.fn(),
});

describe("chatCommands", () => {
	it("lists only the viewer's chats, newest first, and never sends their ids or titles", async () => {
		const entries = sidebarEntries(
			[chat("old", "me", 1), chat("other", "someone", 3), chat("new", null, 2)],
			[],
			"me",
		);
		const commands = chatCommands(entries);
		expect(commands.map((c) => c.title)).toEqual(["Title new", "Title old"]);
		for (const command of commands) {
			expect(analyticsIdOf(command)).toBe("chat.open");
			expect(isRememberable(command)).toBe(false);
		}
		const run = env();
		await commands[0]?.run(run);
		expect(run.openChat).toHaveBeenCalledWith("new");
	});
});

describe("layoutCommands", () => {
	it("opens a layout as a new workspace, newest layout first", async () => {
		const panes = [{ model: null, size: 100, synced: true }];
		const commands = layoutCommands([
			{ id: "a", name: "First", panes, savedAt: 1 },
			{ id: "b", name: "Second", panes, savedAt: 2 },
		]);
		expect(commands.map((c) => c.title)).toEqual([
			"New chat from layout: Second",
			"New chat from layout: First",
		]);
		expect(analyticsIdOf(commands[0] ?? ({} as never))).toBe("layout.new-chat");
		const run = env();
		await commands[1]?.run(run);
		expect(run.openLayout).toHaveBeenCalledWith(panes);
	});
});

describe("settingsCommands", () => {
	it("opens a section, or a row with it highlighted", async () => {
		const commands = settingsCommands();
		const theme = commands.find((c) => c.id === "setting.theme");
		const privacy = commands.find((c) => c.id === "settings.privacy");
		expect(theme?.searchOnly).toBe(true);
		expect(privacy?.searchOnly).toBeUndefined();
		const run = env();
		await theme?.run(run);
		await privacy?.run(run);
		expect(run.openSettings).toHaveBeenCalledWith("appearance", "theme");
		expect(run.openSettings).toHaveBeenCalledWith("privacy");
	});

	it("has fixed, analytics-safe ids", () => {
		for (const command of settingsCommands()) {
			expect(analyticsIdOf(command)).toMatch(/^[a-z0-9][a-z0-9._-]{0,39}$/);
			expect(isRememberable(command)).toBe(true);
		}
	});
});
