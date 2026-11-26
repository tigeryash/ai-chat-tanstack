import type { CodeHighlighterPlugin } from "streamdown";
import { logWarn } from "@/lib/log";

// Code highlighting (roadmap R2 S9) without Shiki in the markdown chunk: @streamdown/code (Shiki on its
// JavaScript regex engine, so no WebAssembly or eval under the CSP) loads with the first code block.
// Until then a block shows plain, as Streamdown does while Shiki loads a language.

type RealPlugin = CodeHighlighterPlugin;

let real: RealPlugin | undefined;
let loading: Promise<RealPlugin> | undefined;

const load = () => {
	loading ??= import("@streamdown/code").then(({ code }) => {
		real = code as RealPlugin;
		return real;
	});
	return loading;
};

export const lazyCodePlugin: CodeHighlighterPlugin = {
	name: "shiki",
	type: "code-highlighter",
	// Unknown languages fall back to plain text inside the real plugin.
	supportsLanguage: (language) => real?.supportsLanguage(language) ?? true,
	getSupportedLanguages: () => real?.getSupportedLanguages() ?? [],
	getThemes: () => real?.getThemes() ?? ["github-light", "github-dark"],
	highlight(options, callback) {
		if (real) return real.highlight(options, callback);
		load()
			.then((plugin) => {
				const result = plugin.highlight(options, callback);
				if (result) callback?.(result);
			})
			.catch((error: unknown) =>
				logWarn("Couldn't load code highlighting:", error),
			);
		return null;
	},
};
