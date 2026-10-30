// The parameter registry (roadmap 2.4b, decision 15): one entry per model setting the settings panel
// can show. Which ones a chat's model and host really take is `support.ts`; how each becomes an AI SDK
// call setting or provider option is `mapping.ts`. A setting the person never touched isn't sent, so
// the provider's own default applies; `default` is only where a control starts.

export const PARAM_IDS = [
	"temperature",
	"topP",
	"topK",
	"minP",
	"repetitionPenalty",
	"presencePenalty",
	"frequencyPenalty",
	"maxOutputTokens",
	"stopSequences",
	"seed",
	"reasoningEffort",
	"reasoningBudget",
	"verbosity",
] as const;
export type ParamId = (typeof PARAM_IDS)[number];

/** Reasoning efforts AI SDK 7's `reasoning` call setting takes (besides "provider-default"). */
export const REASONING_EFFORTS = [
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const VERBOSITIES = ["low", "medium", "high"] as const;

export const MAX_STOP_SEQUENCES = 4;
export const MAX_STOP_SEQUENCE_LENGTH = 100;

interface ParamBase {
	id: ParamId;
	label: string;
	help: string;
	/**
	 * The name OpenRouter and the AI Gateway use, which is also what the 2.4a probe and the catalog's
	 * supported-parameter lists say. Both reasoning settings are `reasoning`.
	 */
	wireName: string;
}

export interface NumberParam extends ParamBase {
	control: "slider" | "number";
	min: number;
	max: number;
	step: number;
	default: number;
	integer?: boolean;
}

export interface SelectParam extends ParamBase {
	control: "select";
	options: readonly string[];
}

export interface StopParam extends ParamBase {
	control: "stop";
}

export type ParamDefinition = NumberParam | SelectParam | StopParam;

export const PARAMS: Readonly<Record<ParamId, ParamDefinition>> = {
	temperature: {
		id: "temperature",
		label: "Temperature",
		help: "Higher is more varied, lower is more focused.",
		wireName: "temperature",
		control: "slider",
		min: 0,
		max: 2,
		step: 0.05,
		default: 1,
	},
	topP: {
		id: "topP",
		label: "Top P",
		help: "Samples only from the most likely words that add up to this share. Change this or temperature, not both.",
		wireName: "top_p",
		control: "slider",
		min: 0,
		max: 1,
		step: 0.01,
		default: 1,
	},
	topK: {
		id: "topK",
		label: "Top K",
		help: "Samples only from this many most likely words.",
		wireName: "top_k",
		control: "number",
		min: 1,
		max: 500,
		step: 1,
		default: 40,
		integer: true,
	},
	minP: {
		id: "minP",
		label: "Min P",
		help: "Drops words less likely than this share of the most likely one.",
		wireName: "min_p",
		control: "slider",
		min: 0,
		max: 1,
		step: 0.01,
		default: 0,
	},
	repetitionPenalty: {
		id: "repetitionPenalty",
		label: "Repetition penalty",
		help: "Above 1 makes repeating words less likely.",
		wireName: "repetition_penalty",
		control: "slider",
		min: 0.5,
		max: 2,
		step: 0.01,
		default: 1,
	},
	presencePenalty: {
		id: "presencePenalty",
		label: "Presence penalty",
		help: "Positive values push the model toward new topics.",
		wireName: "presence_penalty",
		control: "slider",
		min: -2,
		max: 2,
		step: 0.1,
		default: 0,
	},
	frequencyPenalty: {
		id: "frequencyPenalty",
		label: "Frequency penalty",
		help: "Positive values make the model repeat the same words less.",
		wireName: "frequency_penalty",
		control: "slider",
		min: -2,
		max: 2,
		step: 0.1,
		default: 0,
	},
	maxOutputTokens: {
		id: "maxOutputTokens",
		label: "Max output tokens",
		help: "Stops the reply after this many tokens, thinking included on some models.",
		wireName: "max_tokens",
		control: "number",
		min: 1,
		max: 1_000_000,
		step: 1,
		default: 4096,
		integer: true,
	},
	stopSequences: {
		id: "stopSequences",
		label: "Stop sequences",
		help: `The reply ends when it writes one of these. Up to ${MAX_STOP_SEQUENCES}, one per line.`,
		wireName: "stop",
		control: "stop",
	},
	seed: {
		id: "seed",
		label: "Seed",
		help: "The same seed and settings give the same reply, on models that support it.",
		wireName: "seed",
		control: "number",
		min: 0,
		max: 2_147_483_647,
		step: 1,
		default: 0,
		integer: true,
	},
	reasoningEffort: {
		id: "reasoningEffort",
		label: "Reasoning effort",
		help: "How much the model thinks before it answers.",
		wireName: "reasoning",
		control: "select",
		options: REASONING_EFFORTS,
	},
	reasoningBudget: {
		id: "reasoningBudget",
		label: "Thinking budget",
		help: "The most tokens the model may spend thinking. Setting one turns thinking on.",
		wireName: "reasoning",
		control: "number",
		min: 1024,
		max: 128_000,
		step: 1024,
		default: 8192,
		integer: true,
	},
	verbosity: {
		id: "verbosity",
		label: "Verbosity",
		help: "How long and detailed the answer is.",
		wireName: "verbosity",
		control: "select",
		options: VERBOSITIES,
	},
};
