import { Choice } from "@/components/settings/setting-choice";
import type { SettingControlProps } from "@/components/settings/setting-row-props";
import { Button } from "@/components/ui/button";
import {
	CODE_THEME_IDS,
	CODE_THEME_LABELS,
	type CodeThemeId,
} from "@/lib/appearance/code-themes";
import { CODE_FONTS, READING_FONTS, UI_FONTS } from "@/lib/appearance/fonts";
import {
	DENSITIES,
	type Density,
	RADII,
	type Radius,
	READING_WIDTHS,
	type ReadingWidth,
	TEXT_SCALES,
	THEMES,
	type Theme,
} from "@/lib/appearance/schema";
import {
	resetAppearance,
	updateAppearance,
	useAppearance,
} from "@/lib/appearance/store";
import { AccentColor } from "./accent-color";
import { AdvancedColors } from "./advanced-colors";
import { FontSelect } from "./font-select";
import { PresetGrid } from "./preset-grid";
import { ThemeFile } from "./theme-file";

// Settings → Appearance (roadmap 3.11), one control per settings row. Every control overrides design
// tokens (src/styles.css), never a component's styles. Saved in this browser and applied to every open
// tab at once.

const THEME_LABELS: Record<Theme, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

const DENSITY_LABELS: Record<Density, string> = {
	compact: "Compact",
	comfortable: "Comfortable",
};

const RADIUS_LABELS: Record<Radius, string> = {
	sharp: "Sharp",
	default: "Default",
	round: "Round",
};

const READING_WIDTH_LABELS: Record<ReadingWidth, string> = {
	narrow: "Narrow",
	default: "Default",
	full: "Full",
};

export function PresetChoice({ labelId, descriptionId }: SettingControlProps) {
	return (
		<PresetGrid
			labelId={labelId}
			descriptionId={descriptionId}
			settings={useAppearance()}
		/>
	);
}

export function RadiusChoice(props: SettingControlProps) {
	const { radius } = useAppearance();
	return (
		<Choice
			{...props}
			options={RADII}
			labels={RADIUS_LABELS}
			value={radius}
			onChange={(next) => updateAppearance({ radius: next })}
		/>
	);
}

export function ReadingWidthChoice(props: SettingControlProps) {
	const { readingWidth } = useAppearance();
	return (
		<Choice
			{...props}
			options={READING_WIDTHS}
			labels={READING_WIDTH_LABELS}
			value={readingWidth}
			onChange={(next) => updateAppearance({ readingWidth: next })}
		/>
	);
}

export function CodeThemeSelect({ controlId }: SettingControlProps) {
	const { codeTheme } = useAppearance();
	return (
		<select
			id={controlId}
			value={codeTheme}
			onChange={(event) =>
				updateAppearance({ codeTheme: event.target.value as CodeThemeId })
			}
			className="h-9 w-48 rounded-md @lg:justify-self-end border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			{CODE_THEME_IDS.map((id) => (
				<option key={id} value={id}>
					{CODE_THEME_LABELS[id]}
				</option>
			))}
		</select>
	);
}

export function ThemeChoice(props: SettingControlProps) {
	const { theme } = useAppearance();
	return (
		<Choice
			{...props}
			options={THEMES}
			labels={THEME_LABELS}
			value={theme}
			onChange={(next) => updateAppearance({ theme: next })}
		/>
	);
}

export function DensityChoice(props: SettingControlProps) {
	const { density } = useAppearance();
	return (
		<Choice
			{...props}
			options={DENSITIES}
			labels={DENSITY_LABELS}
			value={density}
			onChange={(next) => updateAppearance({ density: next })}
		/>
	);
}

export function AccentColorControl({ controlId }: SettingControlProps) {
	return <AccentColor id={controlId} settings={useAppearance()} />;
}

export function AdvancedColorsControl() {
	return <AdvancedColors settings={useAppearance()} />;
}

export function UiFontSelect({ controlId }: SettingControlProps) {
	const { uiFont } = useAppearance();
	return (
		<FontSelect
			id={controlId}
			fonts={UI_FONTS}
			value={uiFont}
			onChange={(next) => updateAppearance({ uiFont: next })}
		/>
	);
}

export function ReadingFontSelect({ controlId }: SettingControlProps) {
	const { readingFont } = useAppearance();
	return (
		<FontSelect
			id={controlId}
			fonts={READING_FONTS}
			value={readingFont}
			onChange={(next) => updateAppearance({ readingFont: next })}
		/>
	);
}

export function CodeFontSelect({ controlId }: SettingControlProps) {
	const { codeFont } = useAppearance();
	return (
		<FontSelect
			id={controlId}
			fonts={CODE_FONTS}
			value={codeFont}
			onChange={(next) => updateAppearance({ codeFont: next })}
		/>
	);
}

export function ThemeFileControl() {
	return <ThemeFile settings={useAppearance()} />;
}

export function ResetAppearance() {
	return (
		<Button
			size="sm"
			variant="destructive"
			onClick={resetAppearance}
			className="@lg:justify-self-end"
		>
			Reset all
		</Button>
	);
}

export function TextSize({ controlId, descriptionId }: SettingControlProps) {
	const { textScale } = useAppearance();
	const index = TEXT_SCALES.indexOf(textScale);
	return (
		<div className="flex items-center gap-3 @lg:justify-self-end">
			<input
				id={controlId}
				type="range"
				min={0}
				max={TEXT_SCALES.length - 1}
				step={1}
				value={index}
				aria-describedby={descriptionId}
				aria-valuetext={`${textScale * 100}%`}
				onChange={(event) => {
					const scale = TEXT_SCALES[Number(event.target.value)];
					if (scale !== undefined) updateAppearance({ textScale: scale });
				}}
				className="w-40 accent-primary"
			/>
			<output
				htmlFor={controlId}
				className="w-12 text-right text-sm text-muted-foreground tabular-nums"
			>
				{Math.round(textScale * 1000) / 10}%
			</output>
		</div>
	);
}
