import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS } from "./tokens";

// tokens.ts copies styles.css's color defaults; this keeps the two in step.
const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const root = /^:root \{([\s\S]*?)^\}/m.exec(css)?.[1] ?? "";
const NOT_COLORS = new Set([
	"font-size-root",
	"ui-font",
	"reading-font",
	"code-font",
	"radius",
	"pane-radius",
	"composer-shadow",
]);

function declaredTokens(): Map<string, { light: string; dark: string }> {
	const tokens = new Map<string, { light: string; dark: string }>();
	for (const [, name, value] of root.matchAll(
		/^ {2}--([a-z0-9-]+):\s*([^;]+);/gm,
	)) {
		if (NOT_COLORS.has(name)) continue;
		const pair = /^light-dark\(((?:oklch|var)\([^)]*\)),\s*(.+)\)$/.exec(value);
		tokens.set(
			name,
			pair ? { light: pair[1], dark: pair[2] } : { light: value, dark: value },
		);
	}
	return tokens;
}

describe("COLOR_TOKENS", () => {
	it("lists every color token in styles.css with its defaults", () => {
		const declared = declaredTokens();
		expect(declared.size).toBeGreaterThan(30);
		expect(
			Object.fromEntries(
				COLOR_TOKENS.map((t) => [t.name, { light: t.light, dark: t.dark }]),
			),
		).toEqual(Object.fromEntries(declared));
	});
});
