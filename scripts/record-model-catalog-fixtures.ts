// Records the model catalog sources for convex/models.test.ts, trimmed to a few models.
// Tests never call these services; re-run this when a source changes shape:
//   bun scripts/record-model-catalog-fixtures.ts
// Needs ARTIFICIAL_ANALYSIS_API_KEY (Bun reads .env.local). Writes nothing secret: the key is only a header.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARTIFICIAL_ANALYSIS_MODELS_URL } from "../convex/lib/modelCatalog/sources/artificialAnalysis";
import {
	GATEWAY_MODELS_URL,
	gatewayEndpointsUrl,
} from "../convex/lib/modelCatalog/sources/gateway";
import {
	MODELS_DEV_PROVIDER_IDS,
	MODELS_DEV_URL,
} from "../convex/lib/modelCatalog/sources/modelsDev";
import { OPENROUTER_MODELS_URL } from "../convex/lib/modelCatalog/sources/openRouter";

const OUT_DIR = fileURLToPath(
	new URL("../convex/lib/modelCatalog/fixtures/", import.meta.url),
);

// Chosen to cover each matching rule: exact ids, a serving variant, reordered names, pins, a
// hidden batch model, open weights served by several hosts, and a non-language model.
const GATEWAY_IDS = [
	"anthropic/claude-opus-5.5",
	"anthropic/claude-opus-5.5-batch",
	"anthropic/claude-sonnet-4.5",
	"anthropic/claude-haiku-5.5",
	"openai/gpt-6.1-sol",
	"openai/gpt-oss-120b",
	"google/gemini-4-argon",
	"spacexai/grok-4.7",
	"moonshotai/kimi-k3.1-pro",
	"openai/text-embedding-3-small",
];
const AA_SLUGS = [
	"claude-opus-5-5",
	"claude-opus-5-5-xhigh",
	"claude-4-5-sonnet",
	"claude-4-5-sonnet-thinking",
	"claude-haiku-5-5",
	"gpt-6-1-sol",
	"gpt-oss-120b",
	"gemini-4-argon",
	"grok-4-7",
	"kimi-k3-1-pro",
];

type Json = Record<string, unknown>;

async function get(
	url: string,
	headers: Record<string, string> = {},
): Promise<Json> {
	const response = await fetch(url, {
		headers: { accept: "application/json", ...headers },
	});
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return (await response.json()) as Json;
}

function write(name: string, value: unknown) {
	writeFileSync(
		`${OUT_DIR}${name}.json`,
		`${JSON.stringify(value, null, "\t")}\n`,
	);
	console.log(`wrote ${name}.json`);
}

function slugOf(id: string) {
	return id
		.slice(id.indexOf("/") + 1)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-");
}

async function main() {
	const aaKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
	if (!aaKey) throw new Error("ARTIFICIAL_ANALYSIS_API_KEY is not set");
	mkdirSync(OUT_DIR, { recursive: true });

	const gateway = await get(GATEWAY_MODELS_URL);
	const gatewayData = gateway.data as Json[];
	write("gateway-models", {
		...gateway,
		data: gatewayData.filter((model) =>
			GATEWAY_IDS.includes(model.id as string),
		),
	});

	const endpoints: Record<string, Json> = {};
	// The sync never asks for hidden (batch) or non-language models; the Gateway 404s on batch ones.
	for (const id of GATEWAY_IDS.filter((id) => !/embedding|-batch$/.test(id))) {
		endpoints[id] = await get(gatewayEndpointsUrl(id));
	}
	write("gateway-endpoints", endpoints);

	const aa = await get(ARTIFICIAL_ANALYSIS_MODELS_URL, { "x-api-key": aaKey });
	write("artificial-analysis", {
		...aa,
		data: (aa.data as Json[]).filter((model) =>
			AA_SLUGS.includes(model.slug as string),
		),
	});

	// models.dev: our providers only, each cut to models named like a fixture model.
	const slugs = GATEWAY_IDS.map(slugOf);
	const modelsDev = await get(MODELS_DEV_URL);
	const trimmed: Json = {};
	for (const providerId of Object.values(MODELS_DEV_PROVIDER_IDS)) {
		const provider = modelsDev[providerId] as Json | undefined;
		if (!provider) continue;
		const models = Object.fromEntries(
			Object.entries(provider.models as Record<string, Json>).filter(([id]) =>
				slugs.some((slug) => slugOf(id).endsWith(slug)),
			),
		);
		trimmed[providerId] = { ...provider, models };
	}
	write("models-dev", trimmed);

	const openRouter = await get(OPENROUTER_MODELS_URL);
	write("openrouter", {
		...openRouter,
		data: (openRouter.data as Json[]).filter((model) => {
			const id = model.id as string;
			return (
				slugs.includes(slugOf(id)) || id === "~anthropic/claude-opus-latest"
			);
		}),
	});
}

await main();
