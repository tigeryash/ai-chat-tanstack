// Weight formats (quantization) for the "Exclude quantized" host preference (roadmap R2 S3). The
// formats are OpenRouter's `provider.quantizations` values
// (https://openrouter.ai/docs/guides/routing/provider-selection); AI Gateway reports the same names and
// filters with `has: ["!quantization:<format>"]`
// (https://vercel.com/docs/ai-gateway/models-and-providers/model-filtering).

/** Bits per weight. Formats of one width count as equal ("fp8 or better" takes int8 too). */
const FORMAT_BITS = {
	int4: 4,
	fp4: 4,
	mxfp4: 4,
	nvfp4: 4,
	fp6: 6,
	int8: 8,
	fp8: 8,
	mxfp8: 8,
	fp16: 16,
	bf16: 16,
	fp32: 32,
} as const;
type Format = keyof typeof FORMAT_BITS;
const FORMATS = Object.keys(FORMAT_BITS) as Format[];

/** The minimums offered: no filter, 8-bit or better, 16-bit or better. */
export const MIN_PRECISIONS = ["any", "fp8", "fp16"] as const;
export type MinPrecision = (typeof MIN_PRECISIONS)[number];

export const MIN_PRECISION_LABELS: Record<MinPrecision, string> = {
	any: "Any",
	fp8: "fp8 or better",
	fp16: "fp16 or better",
};

const isFormat = (value: string): value is Format => value in FORMAT_BITS;

/**
 * A host's reported format is below the minimum. Unknown or unreported formats pass: closed models
 * (Claude, GPT) never report one, and AI Gateway's negated filter lets them through too.
 */
export function belowPrecision(
	quantization: string | undefined,
	min: MinPrecision,
): boolean {
	if (min === "any" || !quantization) return false;
	const format = quantization.toLowerCase();
	return isFormat(format) && FORMAT_BITS[format] < FORMAT_BITS[min];
}

/**
 * OpenRouter's `provider.quantizations` allowlist for the minimum, with "unknown" so models whose
 * hosts don't report a format (most closed models) still run. Undefined for "any".
 */
export function openRouterQuantizations(
	min: MinPrecision,
): string[] | undefined {
	if (min === "any") return undefined;
	return [
		...FORMATS.filter((format) => !belowPrecision(format, min)),
		"unknown",
	];
}

/** AI Gateway's `has` conditions for the minimum: every format below it, negated. */
export function gatewayQuantizationFilter(
	min: MinPrecision,
): string[] | undefined {
	if (min === "any") return undefined;
	return FORMATS.filter((format) => belowPrecision(format, min)).map(
		(format) => `!quantization:${format}`,
	);
}
