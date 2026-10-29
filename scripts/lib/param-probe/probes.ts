// One probe per generation parameter (roadmap 2.4a). Each sends the smallest request that uses the
// parameter, under OpenRouter's names, so results line up with `supported_parameters` lists.

/** The fewest output tokens we ask for. OpenAI-hosted models reject anything under 16. */
export const MIN_MAX_TOKENS = 16;
/** Tried once when a model refuses MIN_MAX_TOKENS (some reasoning models need room to think). */
export const FALLBACK_MAX_TOKENS = 256;

export type ChatMessage = { role: "user"; content: string };

/** What a probe adds to `{ model, messages, max_tokens }`. */
export type ProbeRequest = {
	messages: ChatMessage[];
	/** Output-token cap for this probe, at least the model's floor. */
	maxTokens: number;
	extra: Record<string, unknown>;
};

/** The parts of an OpenAI-style chat completion the checks read. */
export type ChatCompletion = {
	choices?: {
		finish_reason?: string | null;
		message?: {
			content?: string | null;
			tool_calls?: unknown[] | null;
		};
	}[];
	usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
	error?: { code?: number | string; message?: string };
};

/**
 * Did the parameter visibly change the reply? "unknown" when the reply can't tell (e.g. cut off
 * by max_tokens before the effect could show).
 */
export type CheckResult = "effect" | "no-effect" | "unknown";

export type ProbeContext = {
	/** The model's output-token floor (MIN_MAX_TOKENS, or FALLBACK_MAX_TOKENS when it needed more). */
	floor: number;
};

export type Probe = {
	parameter: string;
	request: (context: ProbeContext) => ProbeRequest;
	check?: (completion: ChatCompletion, request: ProbeRequest) => CheckResult;
	/** Skip models this parameter can't apply to. Default: probe every model. */
	relevant?: (model: {
		gatewayId: string;
		listed: readonly string[];
	}) => boolean;
};

const HI: ChatMessage[] = [{ role: "user", content: "Hi" }];

const PING_TOOL = {
	type: "function",
	function: {
		name: "ping",
		description: "Ping.",
		parameters: { type: "object", properties: {}, additionalProperties: false },
	},
};

function simple(parameter: string, value: unknown): Probe {
	return {
		parameter,
		request: ({ floor }) => ({
			messages: HI,
			maxTokens: floor,
			extra: { [parameter]: value },
		}),
	};
}

function firstChoice(completion: ChatCompletion) {
	return completion.choices?.[0];
}

function contentOf(completion: ChatCompletion): string {
	return firstChoice(completion)?.message?.content ?? "";
}

function finishedCleanly(completion: ChatCompletion): boolean {
	return firstChoice(completion)?.finish_reason === "stop";
}

function hasToolCall(completion: ChatCompletion): boolean {
	return (firstChoice(completion)?.message?.tool_calls?.length ?? 0) > 0;
}

/** JSON-mode replies sometimes come wrapped in a ```json fence; that still counts. */
export function parseJsonReply(content: string): unknown {
	const trimmed = content
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	try {
		return JSON.parse(trimmed);
	} catch {
		return undefined;
	}
}

function checkJson(
	completion: ChatCompletion,
	matches: (value: unknown) => boolean,
): CheckResult {
	const value = parseJsonReply(contentOf(completion));
	if (value !== undefined && matches(value)) return "effect";
	// Cut off by max_tokens, or no text at all (a reasoning model spent the budget thinking).
	if (!finishedCleanly(completion) || contentOf(completion) === "")
		return "unknown";
	return "no-effect";
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The model's floor is found by the baseline request, which is also the `max_tokens` probe. */
export const MAX_TOKENS_PROBE: Probe = {
	parameter: "max_tokens",
	request: ({ floor }) => ({ messages: HI, maxTokens: floor, extra: {} }),
	check: (completion, request) => {
		const used = completion.usage?.completion_tokens;
		if (used === undefined) return "unknown";
		return used <= request.maxTokens ? "effect" : "no-effect";
	},
};

export const PROBES: readonly Probe[] = [
	MAX_TOKENS_PROBE,
	simple("temperature", 0.5),
	simple("top_p", 0.9),
	simple("top_k", 40),
	simple("min_p", 0.05),
	simple("presence_penalty", 0.1),
	simple("frequency_penalty", 0.1),
	simple("repetition_penalty", 1.05),
	simple("seed", 7),
	{
		parameter: "stop",
		request: ({ floor }) => ({
			messages: [{ role: "user", content: "Say exactly: red green blue" }],
			maxTokens: floor,
			extra: { stop: ["green"] },
		}),
		check: (completion) => {
			const content = contentOf(completion).toLowerCase();
			if (!content.includes("red")) return "unknown";
			return content.includes("green") || content.includes("blue")
				? "no-effect"
				: "effect";
		},
	},
	{
		parameter: "reasoning",
		// Reasoning needs a little room on most hosts; still a few cents at most per model.
		request: ({ floor }) => ({
			messages: HI,
			maxTokens: Math.max(floor, 64),
			extra: { reasoning: { effort: "low" } },
		}),
	},
	{
		parameter: "response_format",
		request: ({ floor }) => ({
			messages: [{ role: "user", content: 'Reply with JSON: {"a":1}' }],
			maxTokens: Math.max(floor, 32),
			extra: { response_format: { type: "json_object" } },
		}),
		check: (completion) => checkJson(completion, isObject),
	},
	{
		parameter: "structured_outputs",
		request: ({ floor }) => ({
			messages: [{ role: "user", content: "Say hi." }],
			maxTokens: Math.max(floor, 32),
			extra: {
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "probe",
						strict: true,
						schema: {
							type: "object",
							properties: { a: { type: "string" } },
							required: ["a"],
							additionalProperties: false,
						},
					},
				},
			},
		}),
		check: (completion) =>
			checkJson(
				completion,
				(value) => isObject(value) && typeof value.a === "string",
			),
	},
	{
		parameter: "tools",
		request: ({ floor }) => ({
			messages: [{ role: "user", content: "Call the ping tool." }],
			maxTokens: Math.max(floor, 32),
			extra: { tools: [PING_TOOL] },
		}),
		// A model may answer in text instead of calling, so no call proves nothing.
		check: (completion) => (hasToolCall(completion) ? "effect" : "unknown"),
	},
	{
		parameter: "tool_choice",
		request: ({ floor }) => ({
			messages: HI,
			maxTokens: Math.max(floor, 32),
			extra: {
				tools: [PING_TOOL],
				tool_choice: { type: "function", function: { name: "ping" } },
			},
		}),
		check: (completion) => {
			if (hasToolCall(completion)) return "effect";
			return finishedCleanly(completion) ? "no-effect" : "unknown";
		},
	},
	{
		parameter: "verbosity",
		request: ({ floor }) => ({
			messages: HI,
			maxTokens: floor,
			extra: { verbosity: "low" },
		}),
		// Only OpenAI's GPT-5 line documents it; elsewhere it's noise in the results.
		relevant: ({ gatewayId, listed }) =>
			listed.includes("verbosity") || gatewayId.startsWith("openai/"),
	},
];

/** Probes for one model, optionally narrowed to `only` parameter names. */
export function probesFor(
	model: { gatewayId: string; listed: readonly string[] },
	only?: readonly string[],
): Probe[] {
	return PROBES.filter(
		(probe) =>
			(only === undefined || only.includes(probe.parameter)) &&
			(probe.relevant?.(model) ?? true),
	);
}
