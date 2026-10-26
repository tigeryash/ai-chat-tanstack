import { Component, type ComponentProps, type ReactNode } from "react";
import { harden } from "rehype-harden";
import {
	type Components,
	defaultRehypePlugins,
	type ExtraProps,
	Streamdown,
	type StreamdownProps,
} from "streamdown";
import { logWarn } from "@/lib/log";
import { markdownVerdict } from "@/lib/security/markdown-limits";
import {
	ALLOWED_IMAGE_PREFIXES,
	ALLOWED_LINK_PREFIXES,
	allowedUrl,
	linkDestination,
} from "@/lib/security/markdown-urls";
import { cn } from "@/lib/utils";

// Streamdown for untrusted text (model replies and reasoning; hard rule 5). Raw HTML is parsed and
// then sanitized (GitHub's schema: no script, style, iframes, event handlers, or javascript: URLs).
// rehype-harden then drops any link or image whose protocol isn't safe, and the components below
// allow only ALLOWED_LINK_PREFIXES / ALLOWED_IMAGE_PREFIXES. Callers can't swap the plugins out.

type RehypePlugin = NonNullable<StreamdownProps["rehypePlugins"]>[number];

const strictHarden: RehypePlugin = [
	harden,
	{
		// "*" allows http(s) only; the prefix check in the components is the stricter one.
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

type LinkProps = ComponentProps<"a"> & ExtraProps;
type ImageProps = ComponentProps<"img"> & ExtraProps;

function SafeLink({ href, children, className }: LinkProps) {
	const url = allowedUrl(href, ALLOWED_LINK_PREFIXES);
	if (!url) {
		return <span data-streamdown="blocked-link">{children}</span>;
	}
	return (
		<a
			href={url.href}
			target="_blank"
			rel="noopener noreferrer"
			title={linkDestination(url)}
			data-streamdown="link"
			className={cn(
				"wrap-anywhere font-medium text-primary underline",
				className,
			)}
		>
			{children}
		</a>
	);
}

// Loading a remote image could send chat data out in its URL, so the image only opens on a click,
// in a new tab, where the person can see where it goes.
function ImagePlaceholder({ src, alt }: ImageProps) {
	const url = allowedUrl(src, ALLOWED_IMAGE_PREFIXES);
	const label = alt ? `“${alt}”` : "Image";
	if (!url) {
		return (
			<span
				data-streamdown="blocked-image"
				className="text-muted-foreground text-sm italic"
			>
				[{label} not shown]
			</span>
		);
	}
	return (
		<a
			href={url.href}
			target="_blank"
			rel="noopener noreferrer"
			title={url.href}
			data-streamdown="image-placeholder"
			className="my-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground text-sm hover:text-foreground"
		>
			{label} from {url.host} (opens in a new tab)
		</a>
	);
}

const SAFE_COMPONENTS: Components = {
	a: SafeLink,
	img: ImagePlaceholder,
	// GitHub's schema keeps <picture><source srcset>. With its <img> replaced nothing loads, but a
	// source has nothing to show either.
	source: () => null,
};

export type SafeMarkdownProps = Omit<
	StreamdownProps,
	"rehypePlugins" | "urlTransform" | "allowedTags" | "linkSafety"
>;

export function SafeMarkdown({
	children,
	className,
	components,
	...props
}: SafeMarkdownProps) {
	const text = children ?? "";
	const plain = <PlainText className={className}>{text}</PlainText>;

	return (
		// `data-markdown` marks rendered model output (tests scope their checks to it); `contents`
		// keeps the wrapper out of layout.
		<div data-markdown="" className="contents">
			{markdownVerdict(text) === "plain" ? (
				plain
			) : (
				<MarkdownErrorBoundary text={text} fallback={plain}>
					<Streamdown
						{...props}
						className={className}
						rehypePlugins={hardenedRehypePlugins}
						// Our SafeLink already opens in a new tab with the real host on hover; Streamdown's own
						// link check would wrap it in a confirmation dialog it renders itself.
						linkSafety={{ enabled: false }}
						components={{ ...components, ...SAFE_COMPONENTS }}
					>
						{text}
					</Streamdown>
				</MarkdownErrorBoundary>
			)}
		</div>
	);
}

// Text the markdown pipeline can't take (markdown-limits.ts) or that made it throw. React escapes it.
function PlainText({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<div
			data-streamdown="plain-text"
			className={cn("whitespace-pre-wrap wrap-anywhere", className)}
		>
			{children}
		</div>
	);
}

interface BoundaryProps {
	text: string;
	fallback: ReactNode;
	children: ReactNode;
}

interface BoundaryState {
	text: string;
	failed: boolean;
}

// A reply that crashes the parser shows as plain text instead of taking the chat down. Markdown is
// tried again once the text changes (the next streamed chunk).
class MarkdownErrorBoundary extends Component<BoundaryProps, BoundaryState> {
	state: BoundaryState = { text: this.props.text, failed: false };

	static getDerivedStateFromProps(
		props: BoundaryProps,
		state: BoundaryState,
	): BoundaryState | null {
		return props.text === state.text
			? null
			: { text: props.text, failed: false };
	}

	static getDerivedStateFromError(): Partial<BoundaryState> {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		logWarn("Markdown render failed; showing plain text", error);
	}

	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}
