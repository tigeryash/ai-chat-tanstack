import type { Command, CommandContext, CommandGroup } from "./command";

// The palette's search (roadmap R2 S5, docs/settings-research.md "Behavior"). A leading `>`, `#` or `/`
// keeps one group (actions, chats, settings). Without one, results are grouped in that order. Recently
// run commands come first: in their own group on the opening list, and ahead of equal matches in a
// search. Matching is every word of the query in the title or keywords, case-insensitive.

export const PREFIXES: Record<string, CommandGroup> = {
	">": "actions",
	"#": "chats",
	"/": "settings",
};

export type ResultGroupId = CommandGroup | "recent";

export const GROUP_LABELS: Record<ResultGroupId, string> = {
	recent: "Recent",
	actions: "Actions",
	chats: "Chats",
	settings: "Settings",
};

const GROUP_ORDER: readonly CommandGroup[] = ["actions", "chats", "settings"];

/** How many recent commands the opening list shows. */
export const RECENT_SHOWN = 5;
/** How many chats the opening list shows; a search or `#` shows all that match. */
export const CHATS_SHOWN = 8;

export interface ResultGroup {
	id: ResultGroupId;
	label: string;
	commands: Command[];
}

export interface ParsedQuery {
	group: CommandGroup | null;
	text: string;
}

export function parseQuery(query: string): ParsedQuery {
	const trimmed = query.trimStart();
	const group = PREFIXES[trimmed.charAt(0)] ?? null;
	return { group, text: normalize(group ? trimmed.slice(1) : trimmed) };
}

function normalize(text: string): string {
	return text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/** 0: the title starts with the query; 1: the title has every word; 2: a keyword has them. */
function score(command: Command, text: string, words: string[]): number | null {
	const title = normalize(command.title);
	const haystack = [title, ...command.keywords.map(normalize)].join(" | ");
	if (!words.every((word) => haystack.includes(word))) return null;
	if (title.startsWith(text)) return 0;
	return words.every((word) => title.includes(word)) ? 1 : 2;
}

function grouped(commands: readonly Command[]): ResultGroup[] {
	return GROUP_ORDER.flatMap((id) => {
		const inGroup = commands.filter((command) => command.group === id);
		return inGroup.length > 0
			? [{ id, label: GROUP_LABELS[id], commands: inGroup }]
			: [];
	});
}

/**
 * The palette's results for `query`. `recent` holds command ids, most recent first. Commands whose
 * `when` is false for `context` are left out.
 */
export function searchCommands(
	commands: readonly Command[],
	query: string,
	{ context, recent }: { context: CommandContext; recent: readonly string[] },
): ResultGroup[] {
	const { group, text } = parseQuery(query);
	const available = commands.filter(
		(command) =>
			(group === null || command.group === group) &&
			(command.when?.(context) ?? true),
	);
	const recency = (command: Command) => {
		const index = recent.indexOf(command.id);
		return index === -1 ? recent.length : index;
	};

	if (!text) return openingList(available, group, recent, recency);

	const words = text.split(" ");
	const matches = available.flatMap((command, index) => {
		const rank = score(command, text, words);
		return rank === null ? [] : [{ command, rank, index }];
	});
	matches.sort(
		(a, b) =>
			a.rank - b.rank ||
			recency(a.command) - recency(b.command) ||
			a.index - b.index,
	);
	return grouped(matches.map(({ command }) => command));
}

function openingList(
	available: readonly Command[],
	group: CommandGroup | null,
	recent: readonly string[],
	recency: (command: Command) => number,
): ResultGroup[] {
	// A prefix alone lists its whole group, recent ones first.
	if (group !== null) {
		const sorted = available
			.map((command, index) => ({ command, index }))
			.sort(
				(a, b) => recency(a.command) - recency(b.command) || a.index - b.index,
			)
			.map(({ command }) => command);
		return grouped(sorted);
	}
	const recentCommands = recent
		.flatMap((id) => available.find((command) => command.id === id) ?? [])
		.slice(0, RECENT_SHOWN);
	const shownRecent = new Set(recentCommands);
	const rest = available.filter(
		(command) => !command.searchOnly && !shownRecent.has(command),
	);
	const chats = rest.filter((command) => command.group === "chats");
	const capped = rest.filter(
		(command) =>
			command.group !== "chats" || chats.indexOf(command) < CHATS_SHOWN,
	);
	const recentGroup: ResultGroup[] =
		recentCommands.length > 0
			? [
					{
						id: "recent",
						label: GROUP_LABELS.recent,
						commands: recentCommands,
					},
				]
			: [];
	return [...recentGroup, ...grouped(capped)];
}
