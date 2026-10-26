import { z } from "../../zod";
import { fetchJson } from "./http";
import { dataArrayEnvelope, type Parsed, parseEach } from "./parse";

// OpenRouter's public model list. No key needed.
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const openRouterModelSchema = z.object({
  id: z.string().regex(/^[^/\s]+\/[^\s]+$/),
  supported_parameters: z.array(z.string()).nullish(),
});

export type OpenRouterModel = { id: string; supportedParameters: string[] };

export function parseOpenRouterModels(body: unknown): Parsed<OpenRouterModel> {
  const { data } = dataArrayEnvelope.parse(body);
  const parsed = parseEach(openRouterModelSchema, data);
  return {
    skipped: parsed.skipped,
    items: parsed.items
      // "~anthropic/…" ids are aliases that follow a model family's latest release.
      .filter((model) => !model.id.startsWith("~"))
      .map((model) => ({ id: model.id, supportedParameters: model.supported_parameters ?? [] })),
  };
}

export async function fetchOpenRouterModels(): Promise<Parsed<OpenRouterModel>> {
  return parseOpenRouterModels(await fetchJson(OPENROUTER_MODELS_URL));
}
