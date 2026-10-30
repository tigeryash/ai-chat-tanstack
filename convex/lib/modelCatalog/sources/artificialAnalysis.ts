import { z } from "../../zod";
import { fetchJson } from "./http";
import {
	dataArrayEnvelope,
	optionalNumber,
	type Parsed,
	parseEach,
} from "./parse";

// Artificial Analysis free API: 1,000 requests a day, and anything that shows its numbers must
// credit https://artificialanalysis.ai. One request per sync.
export const ARTIFICIAL_ANALYSIS_MODELS_URL =
	"https://artificialanalysis.ai/api/v2/data/llms/models";
export const ARTIFICIAL_ANALYSIS_KEY_ENV = "ARTIFICIAL_ANALYSIS_API_KEY";

const aaModelSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1),
	name: z.string(),
	model_creator: z.object({ id: z.string().min(1), slug: z.string() }),
	evaluations: z
		.object({
			artificial_analysis_intelligence_index: optionalNumber,
			artificial_analysis_coding_index: optionalNumber,
			artificial_analysis_math_index: optionalNumber,
		})
		.nullish(),
	median_output_tokens_per_second: optionalNumber,
	median_time_to_first_token_seconds: optionalNumber,
});

export type AaModel = {
	id: string;
	slug: string;
	creatorId: string;
	intelligenceIndex?: number;
	codingIndex?: number;
	mathIndex?: number;
	outputTokensPerSecond?: number;
	timeToFirstTokenSeconds?: number;
};

/** Zero means "not measured" in their speed fields. */
function positive(value: number | null | undefined): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: undefined;
}

function score(value: number | null | undefined): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

export function parseArtificialAnalysisModels(body: unknown): Parsed<AaModel> {
	const { data } = dataArrayEnvelope.parse(body);
	const parsed = parseEach(aaModelSchema, data);
	return {
		skipped: parsed.skipped,
		items: parsed.items.map((model) => ({
			id: model.id,
			slug: model.slug,
			creatorId: model.model_creator.id,
			intelligenceIndex: score(
				model.evaluations?.artificial_analysis_intelligence_index,
			),
			codingIndex: score(model.evaluations?.artificial_analysis_coding_index),
			mathIndex: score(model.evaluations?.artificial_analysis_math_index),
			outputTokensPerSecond: positive(model.median_output_tokens_per_second),
			timeToFirstTokenSeconds: positive(
				model.median_time_to_first_token_seconds,
			),
		})),
	};
}

export async function fetchArtificialAnalysisModels(
	apiKey: string,
): Promise<Parsed<AaModel>> {
	return parseArtificialAnalysisModels(
		await fetchJson(ARTIFICIAL_ANALYSIS_MODELS_URL, { "x-api-key": apiKey }),
	);
}
