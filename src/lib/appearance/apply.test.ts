// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { applyAppearance, applySnapshot } from "./apply";
import { APPEARANCE_BOOT_SCRIPT, BOOT_SNAPSHOT_KEY } from "./boot-script";
import { DEFAULT_APPEARANCE } from "./schema";

const root = document.documentElement;

afterEach(() => {
	root.className = "";
	root.removeAttribute("style");
	localStorage.clear();
});

const custom = {
	...DEFAULT_APPEARANCE,
	theme: "dark" as const,
	textScale: 1.25,
	colors: { light: {}, dark: { background: "#101820" } },
};

describe("applyAppearance", () => {
	it("puts the theme class and token overrides on <html>, and stores them for the next load", () => {
		applyAppearance(custom);
		expect(root.classList.contains("dark")).toBe(true);
		expect(root.style.getPropertyValue("--font-size-root")).toBe("125%");
		expect(root.style.getPropertyValue("--background")).toBe(
			"light-dark(oklch(0.985 0 0), #101820)",
		);
		expect(
			JSON.parse(localStorage.getItem(BOOT_SNAPSHOT_KEY) ?? "{}"),
		).toMatchObject({
			v: 1,
			scheme: "dark",
		});
	});

	it("clears what the previous settings set", () => {
		applyAppearance(custom);
		applyAppearance(DEFAULT_APPEARANCE);
		expect(root.className).toBe("");
		expect(root.getAttribute("style")).toBe("");
	});

	it("leaves unrelated inline styles alone", () => {
		root.style.setProperty("overflow", "hidden");
		applySnapshot({ scheme: "light", vars: { "--spacing": "1px" } }, root);
		applySnapshot({ scheme: null, vars: {} }, root);
		expect(root.style.getPropertyValue("overflow")).toBe("hidden");
	});
});

describe("APPEARANCE_BOOT_SCRIPT", () => {
	// Indirect eval runs the inline script in global scope, exactly as the browser would.
	// biome-ignore lint/security/noGlobalEval: the script under test is a fixed string.
	const runBootScript = () => globalThis.eval(APPEARANCE_BOOT_SCRIPT);

	it("replays the stored snapshot", () => {
		applyAppearance(custom);
		root.className = "";
		root.removeAttribute("style");
		runBootScript();
		expect(root.classList.contains("dark")).toBe(true);
		expect(root.style.getPropertyValue("--font-size-root")).toBe("125%");
		expect(root.style.getPropertyValue("--background")).toContain("#101820");
	});

	it("does nothing without a snapshot, and ignores bad ones", () => {
		runBootScript();
		localStorage.setItem(BOOT_SNAPSHOT_KEY, "{not json");
		runBootScript();
		localStorage.setItem(
			BOOT_SNAPSHOT_KEY,
			JSON.stringify({
				v: 1,
				scheme: "evil",
				vars: { color: "red", "--ok": "1px" },
			}),
		);
		runBootScript();
		expect(root.className).toBe("");
		expect(root.style.getPropertyValue("color")).toBe("");
		expect(root.style.getPropertyValue("--ok")).toBe("1px");
	});
});
