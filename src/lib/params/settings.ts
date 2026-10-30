import { z } from "@/lib/zod";
import {
	MAX_STOP_SEQUENCE_LENGTH,
	MAX_STOP_SEQUENCES,
	type NumberParam,
	PARAMS,
	type ParamId,
	REASONING_EFFORTS,
	VERBOSITIES,
} from "./registry";

// What a chat's settings panel holds (roadmap 2.4b): the values the person set, by registry id, and the
// chat's own system prompt. Stored on the chat (ChatStore) and sent in each request's body. An unset
// value isn't sent; an unset system prompt means the shared default (decision 19).

export const MAX_SYSTEM_PROMPT_LENGTH = 50_000;

function numberSchema(param: NumberParam) {
	const base = z.number().min(param.min).max(param.max);
	return param.integer ? base.int() : base;
}

const num = (id: ParamId) => numberSchema(PARAMS[id] as NumberParam).optional();

export const paramValuesSchema = z.object({
	temperature: num("temperature"),
	topP: num("topP"),
	topK: num("topK"),
	minP: num("minP"),
	repetitionPenalty: num("repetitionPenalty"),
	presencePenalty: num("presencePenalty"),
	frequencyPenalty: num("frequencyPenalty"),
	maxOutputTokens: num("maxOutputTokens"),
	stopSequences: z
		.array(z.string().min(1).max(MAX_STOP_SEQUENCE_LENGTH))
		.max(MAX_STOP_SEQUENCES)
		.optional(),
	seed: num("seed"),
	reasoningEffort: z.enum(REASONING_EFFORTS).optional(),
	reasoningBudget: num("reasoningBudget"),
	verbosity: z.enum(VERBOSITIES).optional(),
});
export type ParamValues = z.infer<typeof paramValuesSchema>;

export const chatSettingsSchema = z.object({
	params: paramValuesSchema,
	/** This chat's own prompt. Absent: the shared default. */
	systemPrompt: z.string().max(MAX_SYSTEM_PROMPT_LENGTH).optional(),
});
export type ChatSettings = z.infer<typeof chatSettingsSchema>;

export const EMPTY_SETTINGS: ChatSettings = { params: {} };

/**
 * Keeps each value that's valid on its own, so one bad or out-of-range value (an old export, a range
 * that narrowed) drops that setting, not all of them.
 */
export function cleanParams(raw: unknown): ParamValues {
	if (typeof raw !== "object" || raw === null) return {};
	const entries = Object.entries(raw).filter(([key, value]) => {
		const field =
			paramValuesSchema.shape[key as keyof typeof paramValuesSchema.shape];
		return field?.safeParse(value).success === true;
	});
	return Object.fromEntries(entries) as ParamValues;
}

/** Settings from storage or an import, bad values dropped. */
export function cleanSettings(raw: unknown): ChatSettings {
	if (typeof raw !== "object" || raw === null) return EMPTY_SETTINGS;
	const { params, systemPrompt } = raw as Record<string, unknown>;
	const prompt = chatSettingsSchema.shape.systemPrompt.safeParse(systemPrompt);
	return {
		params: cleanParams(params),
		...(prompt.success && prompt.data !== undefined
			? { systemPrompt: prompt.data }
			: {}),
	};
}

/** One value changed (`undefined` unsets it), as a new object. */
export function withParam<K extends keyof ParamValues>(
	params: ParamValues,
	id: K,
	value: ParamValues[K] | undefined,
): ParamValues {
	const { [id]: _, ...rest } = params;
	return value === undefined ? rest : { ...rest, [id]: value };
}
