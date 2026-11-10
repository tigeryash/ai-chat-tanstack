import { z } from "@/lib/zod";

// Which saved prompt produced a reply (roadmap 3.6b, decision 19): the prompt's id and version, never
// its text. A chat's own prompt carries one while it's still the text applied from the library; a
// model's default prompt carries its current version. A hand-written or shared prompt carries none.
// Kept free of other app imports: chat settings (`params/settings.ts`) and the transport read it.

export interface PromptSource {
	promptId: string;
	version: number;
}

export const promptSourceSchema = z.object({
	promptId: z.string().min(1).max(256),
	version: z.number().int().min(1),
});

/** A source from storage, an import or a request; undefined when absent or bad. */
export function readPromptSource(raw: unknown): PromptSource | undefined {
	const parsed = promptSourceSchema.safeParse(raw);
	return parsed.success ? parsed.data : undefined;
}

/** The source on a reply's metadata (`ReplyMetadata.prompt`); saved and imported chats are untrusted. */
export function replyPromptSource(metadata: unknown): PromptSource | undefined {
	if (typeof metadata !== "object" || metadata === null) return undefined;
	return readPromptSource((metadata as { prompt?: unknown }).prompt);
}
