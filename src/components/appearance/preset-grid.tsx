import type { CSSProperties } from "react";
import type { SettingControlProps } from "@/components/settings/setting-row-props";
import {
	applyPreset,
	matchesPreset,
	PRESETS,
	type Preset,
	presetById,
	withPreset,
} from "@/lib/appearance/presets";
import { previewVars } from "@/lib/appearance/preview";
import type { AppearanceSettings } from "@/lib/appearance/schema";
import { cn } from "@/lib/utils";

// Settings → Appearance → Presets (roadmap R2 S9). Each card is a small pane drawn with the preset's
// own tokens, in the scheme on screen, so it is the live preview. Picking one keeps the theme and text
// size; editing anything after that shows "Custom (from …)".

export function PresetGrid({
	labelId,
	descriptionId,
	settings,
}: Pick<SettingControlProps, "labelId" | "descriptionId"> & {
	settings: AppearanceSettings;
}) {
	const custom = !matchesPreset(settings);
	return (
		<div className="grid gap-3">
			<p
				role="status"
				data-testid="preset-status"
				className="text-sm text-muted-foreground"
			>
				{custom
					? `Custom (from ${presetById(settings.preset).label}). Pick a preset to start over.`
					: `Using ${presetById(settings.preset).label}.`}
			</p>
			<div
				role="radiogroup"
				aria-labelledby={labelId}
				aria-describedby={descriptionId}
				className="grid grid-cols-2 gap-3 @lg:grid-cols-3"
			>
				{PRESETS.map((preset) => (
					<PresetCard
						key={preset.id}
						preset={preset}
						settings={settings}
						checked={!custom && settings.preset === preset.id}
					/>
				))}
			</div>
		</div>
	);
}

function PresetCard({
	preset,
	settings,
	checked,
}: {
	preset: Preset;
	settings: AppearanceSettings;
	checked: boolean;
}) {
	const style = previewVars(withPreset(settings, preset.id)) as CSSProperties;
	return (
		// biome-ignore lint/a11y/useSemanticElements: a card-sized radio; a native input can't hold the preview.
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={preset.label}
			aria-description={preset.description}
			onClick={() => applyPreset(preset.id)}
			className={cn(
				"group grid gap-2 rounded-lg border p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
				checked && "border-primary ring-1 ring-primary",
			)}
		>
			<PresetPreview style={style} />
			<span className="flex flex-col px-1">
				<span className="text-sm font-medium">{preset.label}</span>
				<span className="text-xs text-muted-foreground">
					{preset.description}
				</span>
				{preset.credit && (
					<span className="text-xs text-muted-foreground">{preset.credit}</span>
				)}
			</span>
		</button>
	);
}

/** A mini pane: page, card, a message, a reply line, muted text and a primary button. */
function PresetPreview({ style }: { style: CSSProperties }) {
	return (
		<span
			aria-hidden
			data-preset-preview=""
			style={style}
			className="flex h-24 flex-col rounded-md border bg-background p-2 font-(family-name:--ui-font)"
		>
			<span className="flex flex-1 flex-col gap-1.5 rounded-pane border bg-card p-2 text-card-foreground">
				<span className="ml-auto rounded-md bg-secondary px-1.5 text-[0.625rem] text-secondary-foreground">
					Hi there
				</span>
				<span className="font-reading text-[0.6875rem] leading-tight">
					A reply in the message font.
				</span>
				<span className="mt-auto flex items-center justify-between gap-2">
					<span className="text-[0.625rem] text-muted-foreground">Muted</span>
					<span className="rounded-md bg-primary px-1.5 text-[0.625rem] text-primary-foreground">
						Send
					</span>
				</span>
			</span>
		</span>
	);
}
