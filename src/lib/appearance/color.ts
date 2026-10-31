// Just enough color math for Appearance settings (roadmap 3.11): read the token values styles.css uses
// (`oklch(L C h)` and `#rrggbb`), show them in a color picker (hex) and check text contrast (WCAG 2).

/** Linear-light sRGB, each channel 0–1 (clamped into the sRGB gamut). */
export interface Rgb {
	r: number;
	g: number;
	b: number;
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/;

const OKLCH =
	/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/;

/** A token value as linear sRGB, or null when it isn't a plain color (a `var()`, `transparent`, …). */
export function parseColor(value: string): Rgb | null {
	const text = value.trim().toLowerCase();
	if (HEX_COLOR.test(text)) return hexToLinear(text);
	const match = OKLCH.exec(text);
	if (!match) return null;
	const lightness = Number(match[1]) / (match[2] ? 100 : 1);
	return oklchToLinear(lightness, Number(match[3]), Number(match[4]));
}

function hexToLinear(hex: string): Rgb {
	const channel = (offset: number) =>
		toLinear(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
	return { r: channel(1), g: channel(3), b: channel(5) };
}

function oklchToLinear(lightness: number, chroma: number, hue: number): Rgb {
	const radians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(radians);
	const b = chroma * Math.sin(radians);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return {
		r: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		g: clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		b: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	};
}

function clamp(channel: number): number {
	return Math.min(1, Math.max(0, channel));
}

function toLinear(channel: number): number {
	return channel <= 0.04045
		? channel / 12.92
		: ((channel + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
	return channel <= 0.0031308
		? channel * 12.92
		: 1.055 * channel ** (1 / 2.4) - 0.055;
}

/** `#rrggbb`, for `<input type="color">`. Out-of-gamut colors are clamped. */
export function toHex({ r, g, b }: Rgb): string {
	const hex = (channel: number) =>
		Math.round(fromLinear(channel) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** WCAG 2 relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA for normal-size text. */
export const AA_CONTRAST = 4.5;
