import { describe, expect, it } from "vitest";
import type { Command } from "./command";
import { CHATS_SHOWN, parseQuery, searchCommands } from "./search";

const command = (
	id: string,
	group: Command["group"],
	extra: Partial<Command> = {},
): Command => ({
	id,
	title: id,
	keywords: [],
	group,
	run: () => {},
	...extra,
});

const COMMANDS = [
	command("New chat", "actions", { keywords: ["create"] }),
	command("Go to Prompts", "actions", {
		when: ({ pathname }) => pathname !== "/prompts",
	}),
	command("Travel plans", "chats", { kind: "chat.open" }),
	command("Plan a garden", "chats", { kind: "chat.open" }),
	command("Appearance settings", "settings"),
	command("Theme", "settings", { keywords: ["dark mode"], searchOnly: true }),
];

const context = { pathname: "/new" };
const titles = (query: string, recent: string[] = [], at = context) =>
	searchCommands(COMMANDS, query, { context: at, recent }).map((group) => [
		group.id,
		group.commands.map((c) => c.title),
	]);

describe("parseQuery", () => {
	it("reads a leading prefix as a group", () => {
		expect(parseQuery("> new")).toEqual({ group: "actions", text: "new" });
		expect(parseQuery("#plan")).toEqual({ group: "chats", text: "plan" });
		expect(parseQuery(" /Theme ")).toEqual({
			group: "settings",
			text: "theme",
		});
		expect(parseQuery("plan")).toEqual({ group: null, text: "plan" });
	});
});

describe("searchCommands", () => {
	it("opens on actions, chats and settings, without search-only rows", () => {
		expect(titles("")).toEqual([
			["actions", ["New chat", "Go to Prompts"]],
			["chats", ["Travel plans", "Plan a garden"]],
			["settings", ["Appearance settings"]],
		]);
	});

	it("leaves out commands whose `when` is false", () => {
		expect(titles("go", [], { pathname: "/prompts" })).toEqual([]);
	});

	it("matches every word in titles and keywords, title starts first", () => {
		expect(titles("plan")).toEqual([
			["chats", ["Plan a garden", "Travel plans"]],
		]);
		expect(titles("dark")).toEqual([["settings", ["Theme"]]]);
		expect(titles("plan garden")).toEqual([["chats", ["Plan a garden"]]]);
		expect(titles("nothing like this")).toEqual([]);
	});

	it("keeps one group for a prefix, and lists all of it with no text", () => {
		expect(titles("#")).toEqual([["chats", ["Travel plans", "Plan a garden"]]]);
		expect(titles("/")).toEqual([
			["settings", ["Appearance settings", "Theme"]],
		]);
		expect(titles(">plan")).toEqual([]);
	});

	it("puts recent commands first: their own group, then ahead of equal matches", () => {
		expect(titles("", ["Theme", "missing"])[0]).toEqual(["recent", ["Theme"]]);
		expect(titles("plan", ["Travel plans"])).toEqual([
			["chats", ["Plan a garden", "Travel plans"]],
		]);
		expect(titles("chat", ["Go to Prompts"])).toEqual([
			["actions", ["New chat"]],
		]);
		expect(titles(">", ["Go to Prompts"])).toEqual([
			["actions", ["Go to Prompts", "New chat"]],
		]);
	});

	it("caps chats on the opening list, not in a search", () => {
		const many = Array.from({ length: CHATS_SHOWN + 3 }, (_, i) =>
			command(`Chat ${i}`, "chats", { kind: "chat.open" }),
		);
		const count = (query: string) =>
			searchCommands(many, query, { context, recent: [] })[0]?.commands.length;
		expect(count("")).toBe(CHATS_SHOWN);
		expect(count("chat")).toBe(CHATS_SHOWN + 3);
	});
});
