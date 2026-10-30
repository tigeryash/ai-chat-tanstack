// Brand marks and wordmarks copied from @lobehub/icons 2.48.0 (MIT, github.com/lobehub/lobe-icons), rendered to
// plain SVG files in public/brand-logos/ so the app doesn't carry @lobehub/ui and antd for a few logos. They're
// files rather than inline JSX so they stay out of the JavaScript bundle and cache on their own (quality audit
// P5). To add a brand, render its Mono, Color and Text components from that package to SVG files named
// `<brand>-<mono|color|wordmark>.svg`, with `width` and `height` set from the viewBox, and add an entry here.
// Brands with no color logo (OpenAI, Grok, Kimi, Z.ai, GitHub) only have `mono`.

type SvgProps = { size: number };

export type BrandLogo = {
	title: string;
	/** Single color, drawn in `currentColor`. */
	mono: (props: SvgProps) => React.ReactElement;
	/** The brand's own colors. */
	color?: (props: SvgProps) => React.ReactElement;
	/** The name, drawn in `currentColor`. Its height is `size * textMultiple`. */
	wordmark?: (props: SvgProps) => React.ReactElement;
	/** Gap between mark and wordmark, as a multiple of `size`. */
	spaceMultiple?: number;
	textMultiple?: number;
};

const BASE = "/brand-logos";

/**
 * A single-color SVG file drawn in `currentColor`. An `<img>` can't inherit the text color, so the file is a
 * mask over a box filled with it. `aspect` is the file's width over its height.
 */
function maskLogo(file: string, aspect = 1) {
	const url = `url(${BASE}/${file})`;
	return ({ size }: SvgProps) => (
		<span
			aria-hidden="true"
			className="inline-block shrink-0 bg-current"
			style={{
				width: size * aspect,
				height: size,
				maskImage: url,
				maskSize: "contain",
				maskRepeat: "no-repeat",
				maskPosition: "center",
				WebkitMaskImage: url,
				WebkitMaskSize: "contain",
				WebkitMaskRepeat: "no-repeat",
				WebkitMaskPosition: "center",
			}}
		/>
	);
}

/** A file in the brand's own colors. */
function colorLogo(file: string) {
	return ({ size }: SvgProps) => (
		<img
			src={`${BASE}/${file}`}
			alt=""
			aria-hidden="true"
			width={size}
			height={size}
			className="block shrink-0"
			draggable={false}
		/>
	);
}

export const brandLogos = {
	openai: {
		title: "OpenAI",
		mono: maskLogo("openai-mono.svg"),
		wordmark: maskLogo("openai-wordmark.svg", 3.5),
		spaceMultiple: 0.1,
		textMultiple: 0.75,
	},
	claude: {
		title: "Claude",
		mono: maskLogo("claude-mono.svg"),
		color: colorLogo("claude-color.svg"),
		wordmark: maskLogo("claude-wordmark.svg", 4.0417),
		spaceMultiple: 0.1,
		textMultiple: 0.8,
	},
	gemini: {
		title: "Gemini",
		mono: maskLogo("gemini-mono.svg"),
		color: colorLogo("gemini-color.svg"),
		wordmark: maskLogo("gemini-wordmark.svg", 4.0833),
		spaceMultiple: 0.2,
		textMultiple: 0.8,
	},
	deepseek: {
		title: "DeepSeek",
		mono: maskLogo("deepseek-mono.svg"),
		color: colorLogo("deepseek-color.svg"),
		wordmark: maskLogo("deepseek-wordmark.svg", 5.4583),
		spaceMultiple: 0.2,
		textMultiple: 0.65,
	},
	qwen: {
		title: "Qwen",
		mono: maskLogo("qwen-mono.svg"),
		color: colorLogo("qwen-color.svg"),
		wordmark: maskLogo("qwen-wordmark.svg", 3.125),
		spaceMultiple: 0.2,
		textMultiple: 0.7,
	},
	grok: {
		title: "Grok",
		mono: maskLogo("grok-mono.svg"),
		wordmark: maskLogo("grok-wordmark.svg", 2.625),
		spaceMultiple: 0.2,
		textMultiple: 0.75,
	},
	kimi: {
		title: "Kimi",
		mono: maskLogo("kimi-mono.svg"),
		wordmark: maskLogo("kimi-wordmark.svg", 7.125),
		spaceMultiple: 0.4,
		textMultiple: 0.75,
	},
	zai: {
		title: "Z.ai",
		mono: maskLogo("zai-mono.svg"),
		wordmark: maskLogo("zai-wordmark.svg", 2.0833),
		spaceMultiple: 0.3,
		textMultiple: 0.9,
	},
	meta: {
		title: "Meta",
		mono: maskLogo("meta-mono.svg"),
		color: colorLogo("meta-color.svg"),
		wordmark: maskLogo("meta-wordmark.svg", 3.125),
		spaceMultiple: 0.2,
		textMultiple: 0.75,
	},
	google: {
		title: "Google",
		mono: maskLogo("google-mono.svg"),
		color: colorLogo("google-color.svg"),
	},
	github: {
		title: "Github",
		mono: maskLogo("github-mono.svg"),
		wordmark: maskLogo("github-wordmark.svg", 3.25),
		spaceMultiple: 0.2,
		textMultiple: 0.8,
	},
} satisfies Record<string, BrandLogo>;
