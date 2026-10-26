import { z } from "@/lib/zod";

// Format 0 is a chat from before formats were versioned: messages in the shape this app stored in
// Convex (`messagePartValidator` in convex/schema.ts before roadmap 1.3), which was close to AI SDK
// parts but not the same. Format 1 is AI SDK 7's `UIMessage`. A record without `formatVersion` is format 0.

const toolState = z.enum([
	"input-streaming",
	"input-available",
	"output-available",
	"output-error",
]);

const legacyPart = z.discriminatedUnion("type", [
	z.object({ type: z.literal("text"), text: z.string() }),
	z.object({ type: z.literal("reasoning"), text: z.string() }),
	z.object({
		type: z.literal("tool-invocation"),
		toolCallId: z.string(),
		toolName: z.string(),
		state: toolState,
		input: z.unknown(),
		output: z.unknown().optional(),
		errorText: z.string().optional(),
	}),
	z.object({
		type: z.literal("file"),
		mediaType: z.string(),
		filename: z.string().optional(),
		url: z.string().optional(),
	}),
	z.object({
		type: z.literal("source"),
		sourceType: z.enum(["url", "document"]),
		id: z.string().optional(),
		url: z.string().optional(),
		title: z.string().optional(),
	}),
	z.object({ type: z.literal("step-start") }),
	z.object({ type: z.literal("image"), url: z.string() }),
]);

const legacyMessage = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant", "system", "tool"]),
	parts: z.array(legacyPart),
	content: z.string().optional(),
});

const legacyChat = z.object({
	formatVersion: z.literal(0).optional(),
	id: z.string(),
	title: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
	messages: z.array(legacyMessage),
});

type LegacyPart = z.infer<typeof legacyPart>;

function imageMediaType(url: string): string {
	// "image/*" is AI SDK's "some image" media type; providers map it to a concrete one.
	return /^data:(image\/[\w.+-]+)[;,]/.exec(url)?.[1] ?? "image/*";
}

function toolPart(part: Extract<LegacyPart, { type: "tool-invocation" }>) {
	const base = {
		type: "dynamic-tool" as const,
		toolName: part.toolName,
		toolCallId: part.toolCallId,
		input: part.input,
	};
	switch (part.state) {
		case "output-available":
			return { ...base, state: part.state, output: part.output };
		case "output-error":
			return {
				...base,
				state: part.state,
				errorText: part.errorText ?? "The tool call failed.",
			};
		default:
			return { ...base, state: part.state };
	}
}

// Parts that can't be carried over are dropped: a file or image that lived only in Convex storage
// (no URL), and a source without a URL or title.
function convertPart(part: LegacyPart): object | undefined {
	switch (part.type) {
		// Stored messages are finished, whatever the old streaming flag said.
		case "text":
		case "reasoning":
			return { type: part.type, text: part.text, state: "done" };
		case "tool-invocation":
			return toolPart(part);
		case "file":
			return part.url
				? {
						type: "file",
						mediaType: part.mediaType,
						url: part.url,
						...(part.filename ? { filename: part.filename } : {}),
					}
				: undefined;
		case "image":
			return {
				type: "file",
				mediaType: imageMediaType(part.url),
				url: part.url,
			};
		case "source":
			if (part.sourceType === "url") {
				return part.url
					? {
							type: "source-url",
							sourceId: part.id ?? part.url,
							url: part.url,
							...(part.title ? { title: part.title } : {}),
						}
					: undefined;
			}
			return part.title
				? {
						type: "source-document",
						sourceId: part.id ?? part.title,
						mediaType: "application/octet-stream",
						title: part.title,
					}
				: undefined;
		case "step-start":
			return { type: "step-start" };
	}
}

function convertMessage(message: z.infer<typeof legacyMessage>) {
	// UI messages have no "tool" role: tool results live in the assistant's tool parts.
	if (message.role === "tool") return undefined;
	const parts = message.parts
		.map(convertPart)
		.filter((part) => part !== undefined);
	if (parts.length === 0 && message.content) {
		parts.push({ type: "text", text: message.content, state: "done" });
	}
	// AI SDK rejects user and system messages without parts.
	if (parts.length === 0 && message.role !== "assistant") return undefined;
	return { id: message.id, role: message.role, parts };
}

export function v0ToV1(raw: unknown): unknown {
	const chat = legacyChat.parse(raw);
	return {
		formatVersion: 1,
		id: chat.id,
		title: chat.title ?? "",
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		messages: chat.messages
			.map(convertMessage)
			.filter((message) => message !== undefined),
	};
}
