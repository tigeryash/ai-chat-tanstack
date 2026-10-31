import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Roadmap 3.0b / 3.11: every color the app draws comes from a token in src/styles.css, so Appearance
// settings can restyle everything by overriding tokens. This fails on a literal color (hex, rgb(),
// hsl(), oklch(), or a Tailwind palette class like `text-red-500` or `bg-white`) in a component or route.

const ROOT = join(import.meta.dirname, "..", "..");
const SCANNED = ["src/components", "src/routes"];

// Files whose colors are not part of the theme, each with the reason.
const ALLOWED = new Set([
	// Third-party brand marks (lobehub icons): the brands' own colors.
	"src/components/auth/brand-logos.tsx",
	// The auth pages' WebGL scene: shader colors, left as they are.
	"src/components/background/scene.tsx",
	// XSS payloads: `&#106;` is an HTML entity, not a color.
	"src/routes/e2e/-xss-payloads.ts",
	// The composer is Yash's design (CLAUDE.md hard rule 8): its original colors in every theme.
	"src/components/chat/input.tsx",
	"src/components/chat/input/text-input.tsx",
	"src/components/chat/input/upload-file.tsx",
	"src/components/chat/input/web-search-button.tsx",
]);

const PALETTE =
	"black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILITY =
	"bg|text|border|border-[trblxyse]|ring|ring-offset|outline|from|via|to|fill|stroke|shadow|divide|placeholder|decoration|caret|accent";
const LITERAL_COLOR = new RegExp(
	[
		String.raw`#[0-9a-fA-F]{3,8}\b`,
		String.raw`\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(`,
		String.raw`(?<![\w-])(?:${UTILITY})-(?:${PALETTE})(?:-\d{2,3})?(?:\/\d+)?\b`,
	].join("|"),
);

function sourceFiles(dir: string): string[] {
	return readdirSync(join(ROOT, dir), {
		recursive: true,
		withFileTypes: true,
	})
		.filter((entry) => entry.isFile() && /\.(tsx?|css)$/.test(entry.name))
		.map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
		.filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".gen.ts"));
}

describe("design tokens", () => {
	it("components and routes use no literal colors", () => {
		const offenders = SCANNED.flatMap(sourceFiles)
			.filter((file) => !ALLOWED.has(file))
			.flatMap((file) =>
				readFileSync(join(ROOT, file), "utf8")
					.split("\n")
					.flatMap((line, index) => {
						const match = line.match(LITERAL_COLOR);
						return match ? [`${file}:${index + 1}: ${match[0]}`] : [];
					}),
			);
		expect(offenders).toEqual([]);
	});

	it("catches the kinds of literal colors it is meant to", () => {
		for (const sample of [
			'className="text-black"',
			'className="hover:bg-red-500/10"',
			'className="border-t-white/20"',
			'className="bg-[#101010]/60"',
			"color: rgb(0 0 0 / 0.1)",
			"text-[oklch(70%.1375_229)]",
		]) {
			expect(sample).toMatch(LITERAL_COLOR);
		}
		for (const sample of [
			'className="text-muted-foreground bg-background"',
			'className="ring-ring/50 border-border text-destructive"',
			'className="bg-overlay/70 text-success"',
			'className="to-transparent from-background"',
		]) {
			expect(sample).not.toMatch(LITERAL_COLOR);
		}
	});
});
