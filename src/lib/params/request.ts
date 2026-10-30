import { z } from "@/lib/zod";
import {
	cleanParams,
	MAX_SYSTEM_PROMPT_LENGTH,
	type ParamValues,
} from "./settings";
import { NO_SUPPORT, type ParamSupport, paramSupportSchema } from "./support";

// What a chat request carries besides its model (roadmap 2.4b), in `useChat`'s request `body` next to
// the selection. It never leaves the browser: the transport turns it into `streamText` options.

export interface RequestSettings {
	params: ParamValues;
	/** What the model and host take, worked out by the panel; anything else is stripped. */
	support: ParamSupport;
	/** The system prompt to send. Empty or absent: none. */
	systemPrompt?: string;
}

const systemPromptSchema = z.string().max(MAX_SYSTEM_PROMPT_LENGTH);

/** Reads `body.settings`. Anything unreadable sends nothing extra rather than failing the request. */
export function parseRequestSettings(raw: unknown): RequestSettings {
	if (typeof raw !== "object" || raw === null) {
		return { params: {}, support: NO_SUPPORT };
	}
	const { params, support, systemPrompt } = raw as Record<string, unknown>;
	const parsedSupport = paramSupportSchema.safeParse(support);
	const parsedPrompt = systemPromptSchema.safeParse(systemPrompt);
	return {
		params: cleanParams(params),
		support: parsedSupport.success ? parsedSupport.data : NO_SUPPORT,
		...(parsedPrompt.success && parsedPrompt.data.trim() !== ""
			? { systemPrompt: parsedPrompt.data }
			: {}),
	};
}
