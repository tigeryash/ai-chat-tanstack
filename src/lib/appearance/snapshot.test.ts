import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE } from "./schema";
import { appearanceSnapshot } from "./snapshot";

describe("appearanceSnapshot", () => {
	it("changes nothing for the default theme", () => {
		expect(appearanceSnapshot(DEFAULT_APPEARANCE)).toEqual({
			scheme: null,
			vars: {},
		});
	});

	it("turns each setting into token overrides", () => {
		const snapshot = appearanceSnapshot({
			...DEFAULT_APPEARANCE,
			theme: "light",
			uiFont: "inter",
			readingFont: "source-serif",
			codeFont: "jetbrains-mono",
			textScale: 1.125,
			density: "compact",
		});
		expect(snapshot.scheme).toBe("light");
		expect(snapshot.vars["--font-size-root"]).toBe("112.5%");
		expect(snapshot.vars["--spacing"]).toBe("0.21875rem");
		expect(snapshot.vars["--ui-font"]).toMatch(/^"Inter Variable", /);
		expect(snapshot.vars["--reading-font"]).toMatch(
			/^"Source Serif 4 Variable", /,
		);
		expect(snapshot.vars["--code-font"]).toMatch(
			/^"JetBrains Mono Variable", /,
		);
	});

	it("keeps the other scheme's default when one scheme's color changes", () => {
		const { vars } = appearanceSnapshot({
			...DEFAULT_APPEARANCE,
			colors: {
				light: { card: "#fff8e7" },
				dark: { "card-foreground": "#e0e0ff" },
			},
		});
		expect(vars).toEqual({
			"--card": "light-dark(#fff8e7, oklch(0.1 0 0))",
			"--card-foreground": "light-dark(var(--foreground), #e0e0ff)",
		});
	});

	it("sets the accent in both schemes, with Advanced overrides winning", () => {
		const { vars } = appearanceSnapshot({
			...DEFAULT_APPEARANCE,
			accent: "#3366cc",
			colors: { light: {}, dark: { ring: "#ffffff" } },
		});
		expect(vars["--primary"]).toBe("#3366cc");
		expect(vars["--ring"]).toBe("light-dark(#3366cc, #ffffff)");
		expect(vars["--primary-foreground"]).toBe("oklch(0.985 0 0)");
	});
});
