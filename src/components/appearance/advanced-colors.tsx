import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	type ContrastWarning,
	contrastWarnings,
} from "@/lib/appearance/contrast";
import type { AppearanceSettings } from "@/lib/appearance/schema";
import { setTokenColor } from "@/lib/appearance/store";
import { resolveHex } from "@/lib/appearance/theme-colors";
import {
	COLOR_GROUP_LABELS,
	COLOR_GROUPS,
	COLOR_TOKENS,
	type ColorScheme,
	type ColorToken,
} from "@/lib/appearance/tokens";
import { useEditedScheme } from "./use-edited-scheme";

const TOKEN_LABELS = new Map<string, string>(
	COLOR_TOKENS.map((t) => [t.name, t.label]),
);

/** Every color token, by purpose, for one scheme at a time, with a WCAG AA check on text pairs. */
export function AdvancedColors({ settings }: { settings: AppearanceSettings }) {
	const onScreen = useEditedScheme(settings.theme);
	const [picked, setPicked] = useState<ColorScheme | null>(null);
	const scheme = picked ?? onScreen;
	const warnings = contrastWarnings(settings, scheme);
	const id = useId();

	return (
		<Collapsible className="grid gap-4">
			<CollapsibleTrigger
				render={<Button variant="ghost" size="sm" className="w-fit -ml-2.5" />}
			>
				<ChevronRight className="transition-transform group-data-[panel-open]/button:rotate-90" />
				Advanced colors
			</CollapsibleTrigger>
			<CollapsibleContent className="grid gap-6">
				<div className="flex flex-wrap items-center gap-4">
					<span id={id} className="text-sm font-medium">
						Editing
					</span>
					<RadioGroup
						aria-labelledby={id}
						value={scheme}
						onValueChange={(next) => setPicked(next as ColorScheme)}
						className="flex gap-4"
					>
						{(["light", "dark"] as const).map((option) => (
							<div key={option} className="flex items-center gap-2">
								<RadioGroupItem id={`${id}-${option}`} value={option} />
								<Label htmlFor={`${id}-${option}`}>
									{option === "light" ? "Light theme" : "Dark theme"}
								</Label>
							</div>
						))}
					</RadioGroup>
				</div>
				<ContrastSummary warnings={warnings} />
				{COLOR_GROUPS.map((group) => (
					<fieldset key={group} className="grid gap-2">
						<legend className="mb-2 text-sm font-medium">
							{COLOR_GROUP_LABELS[group]}
						</legend>
						<div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
							{COLOR_TOKENS.filter((t) => t.group === group).map((token) => (
								<TokenRow
									key={token.name}
									token={token}
									scheme={scheme}
									settings={settings}
									lowContrast={warnings.some(
										(w) => w.text === token.name || w.background === token.name,
									)}
								/>
							))}
						</div>
					</fieldset>
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

function TokenRow({
	token,
	scheme,
	settings,
	lowContrast,
}: {
	token: ColorToken;
	scheme: ColorScheme;
	settings: AppearanceSettings;
	lowContrast: boolean;
}) {
	const id = useId();
	const name = token.name as keyof AppearanceSettings["colors"][ColorScheme];
	const overridden = settings.colors[scheme][name] !== undefined;
	return (
		<div className="flex min-h-9 items-center gap-3">
			<input
				id={id}
				type="color"
				value={resolveHex(settings, scheme, name)}
				onChange={(event) => setTokenColor(scheme, name, event.target.value)}
				className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
			/>
			<Label htmlFor={id} className="font-normal">
				{token.label}
				{lowContrast && (
					<span className="text-warning text-xs">Low contrast</span>
				)}
			</Label>
			{overridden && (
				<Button
					size="xs"
					variant="ghost"
					className="ml-auto"
					aria-label={`Reset ${token.label}`}
					onClick={() => setTokenColor(scheme, name, null)}
				>
					Reset
				</Button>
			)}
		</div>
	);
}

function ContrastSummary({ warnings }: { warnings: ContrastWarning[] }) {
	if (warnings.length === 0) {
		return (
			<p role="status" className="text-sm text-muted-foreground">
				All text meets WCAG AA contrast (4.5:1).
			</p>
		);
	}
	return (
		<div role="status" className="grid gap-1 text-sm text-warning">
			<p>Some text is hard to read (below WCAG AA, 4.5:1):</p>
			<ul className="list-disc pl-5">
				{warnings.map((w) => (
					<li key={`${w.text}/${w.background}`}>
						{TOKEN_LABELS.get(w.text)} on {TOKEN_LABELS.get(w.background)}:{" "}
						{w.ratio.toFixed(1)}:1
					</li>
				))}
			</ul>
		</div>
	);
}
