// Shapes of text the markdown pipeline can't handle in reasonable time or stack space. A reply that
// matches one renders as plain text instead (roadmap 1.0): deep nesting overflows the recursive
// remark/rehype passes (2,000 nested `>` or raw HTML tags throw "Maximum call stack size exceeded";
// 1,000 tags was fine), and unmatched emphasis delimiters make micromark quadratic (40,000 `*_` took
// 4.5 s). Measured 2026-10-25 with streamdown 2.5 in Node; the limits
// sit at least 2x below those points, since browsers' stacks differ. A normal 94k-character reply
// renders in about a second.

export const MAX_MARKDOWN_CHARS = 100_000;
export const MAX_NESTING = 32;
export const MAX_EMPHASIS_DELIMITERS = 4_000;
export const MAX_HTML_TAGS = 500;

// Container markers at the start of a line: blockquote `>`, list bullets, ordered-list numbers.
const LEADING_CONTAINERS =
	/^(?:[ \t]*(?:>|[-*+](?=[ \t])|\d{1,9}[.)](?=[ \t]))[ \t]*)+/;
// Four spaces of indent is one level of list or code nesting.
const SPACES_PER_LEVEL = 4;

export type MarkdownVerdict = "markdown" | "plain";

export function markdownVerdict(text: string): MarkdownVerdict {
	if (text.length > MAX_MARKDOWN_CHARS) return "plain";
	// Delimiters and tags only interact within a block, and blocks are parsed one at a time, so the
	// limits apply per blank-line-separated chunk: a long reply with plenty of **bold** stays markdown.
	for (const chunk of text.split(/\n[ \t]*\n/)) {
		if (countMatches(chunk, /[*_~]/g) > MAX_EMPHASIS_DELIMITERS) return "plain";
		if (countMatches(chunk, /<[a-z/!]/gi) > MAX_HTML_TAGS) return "plain";
	}
	return maxNesting(text) > MAX_NESTING ? "plain" : "markdown";
}

function countMatches(text: string, pattern: RegExp): number {
	let count = 0;
	for (const _ of text.matchAll(pattern)) count++;
	return count;
}

function maxNesting(text: string): number {
	let deepest = 0;
	for (const line of text.split("\n")) {
		const containers = LEADING_CONTAINERS.exec(line)?.[0] ?? "";
		const markers = countMatches(containers, /(?:>|[-*+]|\d+[.)])/g);
		const indent = /^[ \t]*/.exec(line)?.[0].replace(/\t/g, "    ").length ?? 0;
		deepest = Math.max(deepest, markers, Math.floor(indent / SPACES_PER_LEVEL));
	}
	return deepest;
}
