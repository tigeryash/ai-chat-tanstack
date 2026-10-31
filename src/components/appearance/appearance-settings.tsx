import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CODE_FONTS, READING_FONTS, UI_FONTS } from "@/lib/appearance/fonts";
import {
	DENSITIES,
	type Density,
	type AppearanceSettings as Settings,
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

const THEME_LABELS: Record<Theme, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

const DENSITY_LABELS: Record<Density, string> = {
	compact: "Compact",
	comfortable: "Comfortable",
};

/**
 * Settings → Appearance (roadmap 3.11). Every control overrides design tokens (src/styles.css), never a
 * component's styles. Saved in this browser and applied to every open tab at once.
 */
export function AppearanceSettings() {
	const settings = useAppearance();

	return (
		<section aria-labelledby="appearance" className="mt-10 grid gap-6">
			<header className="grid gap-2">
				<h2 id="appearance" className="font-semibold">
					Appearance
				</h2>
				<p className="max-w-2xl text-sm text-muted-foreground">
					Make the app look the way you like. Saved in this browser only.
				</p>
			</header>
			<Choice
				label="Theme"
				options={THEMES}
				labels={THEME_LABELS}
				value={settings.theme}
				onChange={(theme) => updateAppearance({ theme })}
			/>
			<div className="grid max-w-xl gap-4 sm:grid-cols-3">
				<FontSelect
					label="Interface font"
					fonts={UI_FONTS}
					value={settings.uiFont}
					onChange={(uiFont) => updateAppearance({ uiFont })}
				/>
				<FontSelect
					label="Message font"
					fonts={READING_FONTS}
					value={settings.readingFont}
					onChange={(readingFont) => updateAppearance({ readingFont })}
				/>
				<FontSelect
					label="Code font"
					fonts={CODE_FONTS}
					value={settings.codeFont}
					onChange={(codeFont) => updateAppearance({ codeFont })}
				/>
			</div>
			<TextSize settings={settings} />
			<Choice
				label="Density"
				options={DENSITIES}
				labels={DENSITY_LABELS}
				value={settings.density}
				onChange={(density) => updateAppearance({ density })}
			/>
			<AccentColor settings={settings} />
			<AdvancedColors settings={settings} />
			<div className="flex flex-wrap items-center gap-3">
				<ThemeFile settings={settings} />
				<Button size="sm" variant="destructive" onClick={resetAppearance}>
					Reset all
				</Button>
			</div>
		</section>
	);
}

function Choice<T extends string>({
	label,
	options,
	labels,
	value,
	onChange,
}: {
	label: string;
	options: readonly T[];
	labels: Record<T, string>;
	value: T;
	onChange: (value: T) => void;
}) {
	const id = useId();
	return (
		<div className="grid gap-2">
			<span id={id} className="text-sm font-medium">
				{label}
			</span>
			<RadioGroup
				aria-labelledby={id}
				value={value}
				onValueChange={(next) => onChange(next as T)}
				className="flex flex-wrap gap-4"
			>
				{options.map((option) => (
					<div key={option} className="flex items-center gap-2">
						<RadioGroupItem id={`${id}-${option}`} value={option} />
						<Label htmlFor={`${id}-${option}`}>{labels[option]}</Label>
					</div>
				))}
			</RadioGroup>
		</div>
	);
}

function TextSize({ settings }: { settings: Settings }) {
	const id = useId();
	const index = TEXT_SCALES.indexOf(settings.textScale);
	return (
		<div className="grid max-w-xs gap-2">
			<div className="flex items-center justify-between">
				<Label htmlFor={id}>Text size</Label>
				<output htmlFor={id} className="text-sm text-muted-foreground">
					{Math.round(settings.textScale * 1000) / 10}%
				</output>
			</div>
			<input
				id={id}
				type="range"
				min={0}
				max={TEXT_SCALES.length - 1}
				step={1}
				value={index}
				aria-valuetext={`${settings.textScale * 100}%`}
				onChange={(event) => {
					const scale = TEXT_SCALES[Number(event.target.value)];
					if (scale !== undefined) updateAppearance({ textScale: scale });
				}}
				className="accent-primary"
			/>
		</div>
	);
}
