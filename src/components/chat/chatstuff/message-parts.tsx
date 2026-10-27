import type {
	DynamicToolUIPart,
	FileUIPart,
	SourceDocumentUIPart,
	SourceUrlUIPart,
	ToolUIPart,
	UIMessage,
} from "ai";
import { FileIcon, LinkIcon, WrenchIcon } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
	ALLOWED_LINK_PREFIXES,
	allowedUrl,
	linkDestination,
} from "@/lib/security/markdown-urls";

// Every non-reasoning part a message can hold. Model output is untrusted (hard rule 5): text goes
// through SafeMarkdown, links through the same URL allowlist, and tool data is shown as escaped text.

type Part = UIMessage["parts"][number];

function SourceUrl({ part }: { part: SourceUrlUIPart }) {
	const url = allowedUrl(part.url, ALLOWED_LINK_PREFIXES);
	const label = part.title || (url ? linkDestination(url) : part.url);
	return (
		<p className="flex items-center gap-1 text-sm text-muted-foreground">
			<LinkIcon className="size-3.5" aria-hidden />
			{url ? (
				<a
					href={url.href}
					target="_blank"
					rel="noopener noreferrer"
					title={linkDestination(url)}
					className="underline"
				>
					{label}
				</a>
			) : (
				<span>{label}</span>
			)}
		</p>
	);
}

function SourceDocument({ part }: { part: SourceDocumentUIPart }) {
	return (
		<p className="flex items-center gap-1 text-sm text-muted-foreground">
			<FileIcon className="size-3.5" aria-hidden />
			{part.title}
			{part.filename && ` (${part.filename})`}
		</p>
	);
}

// Images that are already in the message (data: or blob: URLs) display inline; the CSP allows those.
// Anything remote stays a label, like images in markdown, so rendering never makes a request.
function File({ part }: { part: FileUIPart }) {
	const inline = /^(data|blob):/.test(part.url);
	if (inline && part.mediaType.startsWith("image/")) {
		return (
			<img
				src={part.url}
				alt={part.filename ?? "Attached image"}
				className="max-h-80 rounded-md border"
			/>
		);
	}
	return (
		<p className="flex items-center gap-1 text-sm">
			<FileIcon className="size-4" aria-hidden />
			{part.filename ?? "File"} · {part.mediaType}
		</p>
	);
}

const TOOL_STATE_LABELS: Record<ToolUIPart["state"], string> = {
	"input-streaming": "preparing",
	"input-available": "running",
	"approval-requested": "waiting for approval",
	"approval-responded": "approved",
	"output-available": "done",
	"output-error": "failed",
	"output-denied": "denied",
};

function json(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2) ?? "";
	} catch {
		return String(value);
	}
}

function Tool({
	name,
	part,
}: {
	name: string;
	part: ToolUIPart | DynamicToolUIPart;
}) {
	return (
		<details className="rounded-md border px-3 py-2 text-sm" data-tool={name}>
			<summary className="flex cursor-pointer items-center gap-2">
				<WrenchIcon className="size-3.5" aria-hidden />
				<span className="font-mono">{name}</span>
				<span className="text-muted-foreground">
					{TOOL_STATE_LABELS[part.state] ?? part.state}
				</span>
			</summary>
			{part.input !== undefined && (
				<pre className="mt-2 overflow-x-auto text-xs">{json(part.input)}</pre>
			)}
			{part.state === "output-available" && (
				<pre className="mt-2 overflow-x-auto text-xs">{json(part.output)}</pre>
			)}
			{part.state === "output-error" && (
				<p className="mt-2 text-destructive">{part.errorText}</p>
			)}
		</details>
	);
}

/** One part of a message's content. Reasoning is drawn above the content (MessageUI), not here. */
export function MessagePart({
	part,
	role,
}: {
	part: Part;
	role: UIMessage["role"];
}) {
	if (part.type === "text") {
		// The person's own text shows exactly as typed: line breaks and spacing kept, no markdown. Only
		// model replies render as markdown.
		return role === "user" ? (
			<p className="whitespace-pre-wrap">{part.text}</p>
		) : (
			<MessageResponse>{part.text}</MessageResponse>
		);
	}
	if (part.type === "file") return <File part={part} />;
	if (part.type === "source-url") return <SourceUrl part={part} />;
	if (part.type === "source-document") return <SourceDocument part={part} />;
	if (part.type === "dynamic-tool") {
		return <Tool name={part.toolName} part={part} />;
	}
	if (part.type.startsWith("tool-")) {
		return (
			<Tool name={part.type.slice("tool-".length)} part={part as ToolUIPart} />
		);
	}
	// step-start, reasoning (drawn elsewhere) and app data parts have nothing to show here.
	return null;
}
