import { describe, expect, it } from "vitest";
import {
	MAX_EMPHASIS_DELIMITERS,
	MAX_HTML_TAGS,
	MAX_MARKDOWN_CHARS,
	MAX_NESTING,
	markdownVerdict,
} from "@/lib/security/markdown-limits";
import {
	ALLOWED_IMAGE_PREFIXES,
	ALLOWED_LINK_PREFIXES,
	allowedUrl,
	linkDestination,
} from "@/lib/security/markdown-urls";

describe("allowedUrl", () => {
	it.each([
		"https://example.com/a?b=c",
		"http://example.org",
		"HTTPS://EXAMPLE.COM",
		"mailto:someone@example.com",
	])("allows the link %s", (href) => {
		expect(allowedUrl(href, ALLOWED_LINK_PREFIXES)).not.toBeNull();
	});

	it.each([
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)",
		" javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox",
		"blob:https://example.com/uuid",
		"/relative/path",
		"//example.com/protocol-relative",
		"#fragment",
		"",
		undefined,
	])("refuses the link %s", (href) => {
		expect(allowedUrl(href, ALLOWED_LINK_PREFIXES)).toBeNull();
	});

	it("allows only https images", () => {
		expect(
			allowedUrl("https://x.test/a.png", ALLOWED_IMAGE_PREFIXES),
		).not.toBeNull();
		expect(
			allowedUrl("http://x.test/a.png", ALLOWED_IMAGE_PREFIXES),
		).toBeNull();
		expect(
			allowedUrl("data:image/png;base64,AAAA", ALLOWED_IMAGE_PREFIXES),
		).toBeNull();
	});

	it("shows the real host, not the link text", () => {
		expect(linkDestination(new URL("https://attacker.example/login"))).toBe(
			"attacker.example",
		);
		expect(linkDestination(new URL("mailto:a@example.com"))).toBe(
			"a@example.com",
		);
	});
});

describe("markdownVerdict", () => {
	it("keeps ordinary and long-but-normal replies as markdown", () => {
		expect(markdownVerdict("# Title\n\n- a\n- **b**\n\n> quote")).toBe(
			"markdown",
		);
		const longReply = "Some **bold** and _em_ text.\n\n".repeat(2_000);
		expect(markdownVerdict(longReply)).toBe("markdown");
	});

	it.each([
		["too long", "a".repeat(MAX_MARKDOWN_CHARS + 1)],
		["deep blockquotes", `${"> ".repeat(MAX_NESTING + 1)}x`],
		["deep bullets", `${"- ".repeat(MAX_NESTING + 1)}x`],
		["deep ordered lists", `${"1. ".repeat(MAX_NESTING + 1)}x`],
		["deep indentation", `${" ".repeat(4 * (MAX_NESTING + 1))}- x`],
		["unmatched emphasis", "*_".repeat(MAX_EMPHASIS_DELIMITERS)],
		["nested html", "<div>".repeat(MAX_HTML_TAGS + 1)],
	])("renders %s as plain text", (_, text) => {
		expect(markdownVerdict(text)).toBe("plain");
	});

	it("allows nesting up to the limit", () => {
		expect(markdownVerdict(`${"> ".repeat(MAX_NESTING)}x`)).toBe("markdown");
	});
});
