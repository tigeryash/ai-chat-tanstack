import { harden } from "rehype-harden";
import {
	defaultRehypePlugins,
	Streamdown,
	type StreamdownProps,
} from "streamdown";

// Streamdown with SafeMarkdown's fixed plugins. Only `safe-markdown.tsx` imports this, lazily, so the
// markdown stack loads when there's markdown to render. Render untrusted text through SafeMarkdown,
// never this directly: SafeMarkdown adds the safe link and image components (hard rule 5).

type RehypePlugin = NonNullable<StreamdownProps["rehypePlugins"]>[number];

const strictHarden: RehypePlugin = [
	harden,
	{
		// "*" allows http(s) only; the prefix check in SafeMarkdown's components is the stricter one.
		allowedLinkPrefixes: ["*"],
		allowedImagePrefixes: ["*"],
		allowDataImages: false,
	},
];

// Streamdown's defaults are raw → sanitize → harden with everything allowed; only harden changes.
const hardenedRehypePlugins: RehypePlugin[] = [
	defaultRehypePlugins.raw,
	defaultRehypePlugins.sanitize,
	strictHarden,
];

export default function HardenedStreamdown(
	props: Omit<
		StreamdownProps,
		"rehypePlugins" | "urlTransform" | "allowedTags" | "linkSafety"
	>,
) {
	return (
		<Streamdown
			{...props}
			rehypePlugins={hardenedRehypePlugins}
			// SafeMarkdown's link already opens in a new tab with the real host on hover; Streamdown's own
			// link check would wrap it in a confirmation dialog it renders itself.
			linkSafety={{ enabled: false }}
		/>
	);
}
