// A line diff between two versions of a prompt (roadmap 3.6), for the history's diff view. Longest
// common subsequence over lines: prompts are short (at most MAX_SYSTEM_PROMPT_LENGTH characters), so
// the O(n·m) table is fine. Above MAX_CELLS it gives up on alignment and shows old removed, new added.

export type DiffKind = "same" | "added" | "removed";

export interface DiffLine {
	kind: DiffKind;
	text: string;
}

const MAX_CELLS = 4_000_000;

function splitLines(text: string): string[] {
	return text === "" ? [] : text.split(/\r?\n/);
}

function lcsTable(a: readonly string[], b: readonly string[]): Uint32Array[] {
	const table = Array.from(
		{ length: a.length + 1 },
		() => new Uint32Array(b.length + 1),
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			table[i][j] =
				a[i] === b[j]
					? table[i + 1][j + 1] + 1
					: Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	return table;
}

/** From `before` to `after`, line by line, removals before additions where lines changed. */
export function diffLines(before: string, after: string): DiffLine[] {
	const a = splitLines(before);
	const b = splitLines(after);
	if (a.length * b.length > MAX_CELLS) {
		return [
			...a.map((text) => ({ kind: "removed" as const, text })),
			...b.map((text) => ({ kind: "added" as const, text })),
		];
	}
	const table = lcsTable(a, b);
	const lines: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			lines.push({ kind: "same", text: a[i] });
			i++;
			j++;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			lines.push({ kind: "removed", text: a[i++] });
		} else {
			lines.push({ kind: "added", text: b[j++] });
		}
	}
	for (; i < a.length; i++) lines.push({ kind: "removed", text: a[i] });
	for (; j < b.length; j++) lines.push({ kind: "added", text: b[j] });
	return lines;
}

/** How many lines were added and removed. */
export function diffStats(lines: readonly DiffLine[]): {
	added: number;
	removed: number;
} {
	return {
		added: lines.filter((line) => line.kind === "added").length,
		removed: lines.filter((line) => line.kind === "removed").length,
	};
}
