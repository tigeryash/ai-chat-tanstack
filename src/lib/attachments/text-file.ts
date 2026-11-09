// Text and code attachments (roadmap 1.6b). Providers take text `file` parts unevenly (the AI SDK throws
// for most, local models never see them), so a text file is read in the page and sent as a text part
// instead: every text model can read it, and it is never refused for what the model reads. In the chat and
// in storage it stays a `file` part like any attachment, so chips, reloads and exports work the same.
// `validate.ts` and `process.ts` call in here; the transport calls `textFilesAsText`.

import type { UIMessage } from "ai";
import { dataUrlToBytes } from "@/lib/storage/attachments";

export const MAX_TEXT_FILE_SIZE_MB = 1;

/**
 * Extensions read as text whatever type the browser reports: browsers often give code files an empty
 * type or a wrong one (`.ts` comes in as `video/mp2t`).
 */
// biome-ignore format: a row per kind of file reads better than one extension per line
export const TEXT_FILE_EXTENSIONS = [
	"txt", "md", "markdown", "mdx", "rst", "log", "csv", "tsv",
	"json", "jsonc", "json5", "ndjson", "yaml", "yml", "toml", "xml", "ini", "cfg", "conf", "properties",
	"html", "htm", "css", "scss", "sass", "less",
	"js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx", "vue", "svelte", "astro",
	"py", "rb", "php", "java", "kt", "kts", "scala", "go", "rs", "c", "h", "cpp", "cc", "hpp", "cs",
	"swift", "m", "dart", "lua", "r", "pl", "ex", "exs", "erl", "hs", "clj", "elm", "zig", "nim",
	"sh", "bash", "zsh", "fish", "ps1", "bat", "sql", "graphql", "gql", "proto", "tf", "diff", "patch",
] as const;

/** Extension-less files that are text by name. */
const TEXT_FILE_NAMES = new Set([
	"dockerfile",
	"makefile",
	"license",
	"readme",
]);

const TEXT_APPLICATION_TYPES = new Set([
	"application/json",
	"application/ld+json",
	"application/yaml",
	"application/x-yaml",
	"application/toml",
	"application/xml",
	"application/javascript",
	"application/typescript",
	"application/sql",
	"application/graphql",
	"application/x-sh",
]);

/** For the file picker's `accept`. */
export const TEXT_FILE_ACCEPT = [
	"text/*",
	...TEXT_APPLICATION_TYPES,
	...TEXT_FILE_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

const extensions = new Set<string>(TEXT_FILE_EXTENSIONS);

function extensionOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function isTextType(type: string): boolean {
	const base = type.split(";")[0]?.trim().toLowerCase() ?? "";
	return base.startsWith("text/") || TEXT_APPLICATION_TYPES.has(base);
}

/** Whether a file (or a stored file part) is a text attachment: by type, extension or name. */
export function isTextFile({
	name,
	type,
}: {
	name: string;
	type: string;
}): boolean {
	if (isTextType(type)) return true;
	const ext = extensionOf(name);
	return ext ? extensions.has(ext) : TEXT_FILE_NAMES.has(name.toLowerCase());
}

/** The size refusal for a text file, if any. Never one for the model: every text model reads text. */
export function textFileRefusal(file: File): string | undefined {
	if (file.size > MAX_TEXT_FILE_SIZE_MB * 1024 * 1024) {
		return `${file.name} is larger than ${MAX_TEXT_FILE_SIZE_MB} MB, the limit for text files.`;
	}
	return undefined;
}

/** A file refused once it was read. Its message is user-facing and never quotes the file. */
export class AttachmentRefusal extends Error {
	override name = "AttachmentRefusal";
}

/**
 * Reads a text file, refusing one that isn't UTF-8 text (binary renamed `.txt`), and gives it back with a
 * text type, so the stored part says what it is even when the browser reported none.
 */
export async function readTextFile(file: File): Promise<File> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	try {
		const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		if (text.includes("\u0000")) throw new Error("NUL byte");
	} catch {
		throw new AttachmentRefusal(
			`${file.name} isn't a UTF-8 text file, so it wasn't attached.`,
		);
	}
	const type = isTextType(file.type) ? file.type : "text/plain";
	return new File([bytes], file.name, {
		type,
		lastModified: file.lastModified,
	});
}

const LANGUAGE_ALIASES: Record<string, string> = {
	txt: "text",
	log: "text",
	md: "markdown",
	yml: "yaml",
	htm: "html",
	mjs: "js",
	cjs: "js",
	py: "python",
	rb: "ruby",
	rs: "rust",
	kt: "kotlin",
	kts: "kotlin",
	sh: "bash",
	h: "c",
	hpp: "cpp",
	cc: "cpp",
	cs: "csharp",
};

/**
 * The text a file is sent as: its name, then its content in a fenced block with a language hint. The
 * fence is longer than any run of backticks inside, so the content can't close it early.
 */
export function textFilePrompt(filename: string, content: string): string {
	const name = filename.replace(/[\r\n]+/g, " ").trim() || "file";
	const ext = extensionOf(name);
	const language = LANGUAGE_ALIASES[ext] ?? ext;
	const longest = Math.max(
		2,
		...[...content.matchAll(/`+/g)].map((run) => run[0].length),
	);
	const fence = "`".repeat(longest + 1);
	return `File: ${name}\n${fence}${language}\n${content}\n${fence}`;
}

type Part = UIMessage["parts"][number];

/** Turns every text file part into a text part with its content, for the model; other parts stay. */
export function textFilesAsText(messages: UIMessage[]): UIMessage[] {
	return messages.map((message) => {
		const isText = (part: Part) =>
			part.type === "file" &&
			isTextFile({ name: part.filename ?? "", type: part.mediaType });
		if (!message.parts.some(isText)) return message;
		const parts = message.parts.map((part): Part => {
			if (part.type !== "file" || !isText(part)) return part;
			const file = dataUrlToBytes(part.url);
			// Not loaded (a missing stored file): say so rather than send nothing.
			const content = file
				? new TextDecoder().decode(file.bytes)
				: "(this file couldn't be read)";
			return {
				type: "text",
				text: textFilePrompt(part.filename ?? "", content),
			};
		});
		return { ...message, parts };
	});
}
