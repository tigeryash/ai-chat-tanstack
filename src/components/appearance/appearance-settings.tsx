import type { SettingControlProps } from "@/components/settings/setting-row-props";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CODE_FONTS, READING_FONTS, UI_FONTS } from "@/lib/appearance/fonts";
import {
	DENSITIES,
	type Density,
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

function Choice<T extends string>({
	controlId,
	labelId,
	descriptionId,
	options,
	labels,
	value,
	onChange,
}: SettingControlProps & {
	options: readonly T[];
	labels: Record<T, string>;
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<RadioGroup
			aria-labelledby={labelId}
			aria-describedby={descriptionId}
			value={value}
			onValueChange={(next) => onChange(next as T)}
			className="flex flex-wrap gap-4 @lg:justify-self-end"
		>
			{options.map((option) => (
				<div key={option} className="flex items-center gap-2">
					<RadioGroupItem id={`${controlId}-${option}`} value={option} />
					<Label htmlFor={`${controlId}-${option}`}>{labels[option]}</Label>
				</div>
			))}
		</RadioGroup>
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
