import { z } from "../../zod";

/** A source's items that passed validation, plus how many didn't (logged, never fatal). */
export type Parsed<T> = { items: T[]; skipped: number };

/**
 * Validates each item on its own, so one odd entry drops that entry instead of the whole source.
 * The envelope itself must parse, or the source counts as failed.
 */
export function parseEach<T>(schema: z.ZodType<T>, items: readonly unknown[]): Parsed<T> {
  const parsed: T[] = [];
  let skipped = 0;
  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) parsed.push(result.data);
    else skipped += 1;
  }
  return { items: parsed, skipped };
}

/** `{ data: [...] }`, the envelope the Gateway, Artificial Analysis and OpenRouter share. */
export const dataArrayEnvelope = z.object({ data: z.array(z.unknown()) });

/** A long-context price tier. The first tier sometimes leaves out `min` (it starts at 0). */
const tierSchema = z.object({
  cost: z.string(),
  min: z.number().nullish(),
  max: z.number().nullish(),
});

/** Tiers are extra detail: a malformed list is dropped rather than failing the whole model. */
export const tierList = z.array(tierSchema).nullish().catch(null);

/** Optional number that tolerates `null`. */
export const optionalNumber = z.number().nullish();
export const optionalString = z.string().nullish();
export const stringList = z.array(z.string()).nullish().catch(null);
