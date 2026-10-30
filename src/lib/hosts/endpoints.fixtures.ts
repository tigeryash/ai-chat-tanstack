// Made-up endpoint data shaped like OpenRouter's and AI Gateway's public endpoint APIs, for unit tests
// and e2e (e2e/support/fixtures.ts answers both APIs with it, so nothing leaves the machine). Prices
// are per token, as the APIs send them.

const perMillion = (usd: number) => String(usd / 1_000_000);

const PARAMS = [
	"tools",
	"tool_choice",
	"response_format",
	"structured_outputs",
];
const REASONING = ["reasoning", "include_reasoning"];

function openRouterEndpoint(fields: {
	provider: string;
	tag: string;
	input: number;
	output: number;
	uptime: number;
	status?: number;
	latency?: number;
	throughput?: number;
	params?: string[];
	quantization?: string;
}) {
	return {
		name: `${fields.provider} | model`,
		provider_name: fields.provider,
		tag: fields.tag,
		context_length: 128_000,
		max_completion_tokens: 32_000,
		pricing: {
			prompt: perMillion(fields.input),
			completion: perMillion(fields.output),
		},
		quantization: fields.quantization ?? "unknown",
		supported_parameters: fields.params ?? [...PARAMS, ...REASONING],
		status: fields.status ?? 0,
		uptime_last_30m: fields.uptime,
		latency_last_30m: fields.latency ?? null,
		throughput_last_30m: fields.throughput ?? null,
	};
}

function gatewayEndpoint(fields: {
	provider: string;
	input: number;
	output: number;
	uptime: number;
	noTraining: boolean;
	zdr: boolean;
	latency?: number;
	throughput?: number;
	vision?: boolean;
}) {
	return {
		name: `${fields.provider} | model`,
		provider_name: fields.provider,
		context_length: 128_000,
		max_completion_tokens: 32_000,
		pricing: {
			prompt: perMillion(fields.input),
			completion: perMillion(fields.output),
		},
		has_zdr: fields.zdr,
		has_no_training: fields.noTraining,
		tags: fields.vision ? ["tool-use", "vision"] : ["tool-use"],
		quantization: null,
		supported_parameters: [...PARAMS, ...REASONING],
		status: 0,
		uptime_last_1h: fields.uptime,
		latency_last_1h:
			fields.latency === undefined
				? null
				: { p50: fields.latency, p95: fields.latency * 3 },
		throughput_last_1h:
			fields.throughput === undefined
				? null
				: { p50: fields.throughput, p95: fields.throughput * 1.2 },
	};
}

const textOnly = { input_modalities: ["text"], output_modalities: ["text"] };

/** OpenRouter's `/models/{id}/endpoints` answers, by OpenRouter id. */
export const TEST_OPENROUTER_ENDPOINTS: Record<string, unknown> = {
	"deepseek/deepseek-v4.1-flash": {
		data: {
			id: "deepseek/deepseek-v4.1-flash",
			architecture: textOnly,
			endpoints: [
				openRouterEndpoint({
					provider: "DeepInfra",
					tag: "deepinfra/fp8",
					input: 0.08,
					output: 0.3,
					uptime: 100,
					latency: 900,
					throughput: 60,
					quantization: "fp8",
				}),
				openRouterEndpoint({
					provider: "Fireworks",
					tag: "fireworks",
					input: 0.12,
					output: 0.5,
					uptime: 99.8,
					latency: 400,
					throughput: 180,
				}),
				openRouterEndpoint({
					provider: "Baseten",
					tag: "baseten",
					input: 0.3,
					output: 1.2,
					uptime: 90,
					status: -2,
					latency: 700,
					throughput: 240,
				}),
				openRouterEndpoint({
					provider: "Reka",
					tag: "reka",
					input: 0.04,
					output: 0.5,
					uptime: 40,
					status: -3,
				}),
			],
		},
	},
};

/** AI Gateway's `/models/{id}/endpoints` answers, by Gateway id. */
export const TEST_GATEWAY_ENDPOINTS: Record<string, unknown> = {
	"deepseek/deepseek-v4.1-flash": {
		data: {
			id: "deepseek/deepseek-v4.1-flash",
			architecture: textOnly,
			endpoints: [
				gatewayEndpoint({
					provider: "fireworks",
					input: 0.12,
					output: 0.5,
					uptime: 99.9,
					noTraining: true,
					zdr: true,
					latency: 380,
					throughput: 190,
				}),
				gatewayEndpoint({
					provider: "deepinfra",
					input: 0.08,
					output: 0.3,
					uptime: 99.9,
					noTraining: false,
					zdr: false,
					latency: 950,
					throughput: 55,
				}),
				gatewayEndpoint({
					provider: "baseten",
					input: 0.3,
					output: 1.2,
					uptime: 99.9,
					noTraining: true,
					zdr: true,
					latency: 700,
					throughput: 240,
				}),
				gatewayEndpoint({
					provider: "deepseek",
					input: 0.1,
					output: 0.4,
					uptime: 99.5,
					noTraining: false,
					zdr: false,
					latency: 1200,
					throughput: 40,
				}),
			],
		},
	},
};

/** What either API answers for a model it has no fixture for: no endpoints. */
export function testEndpointsFor(
	source: "openrouter" | "gateway",
	modelId: string,
): unknown {
	const table =
		source === "openrouter"
			? TEST_OPENROUTER_ENDPOINTS
			: TEST_GATEWAY_ENDPOINTS;
	return (
		table[modelId] ?? {
			data: { id: modelId, architecture: textOnly, endpoints: [] },
		}
	);
}
