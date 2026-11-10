import { Button } from "@/components/ui/button";
import type { AppearanceSettings } from "@/lib/appearance/schema";
import { updateAppearance } from "@/lib/appearance/store";
import { resolveHex } from "@/lib/appearance/theme-colors";
import { useEditedScheme } from "./use-edited-scheme";

/** Primary buttons, selection and focus rings in both themes; text on it picks dark or light itself. */
export function AccentColor({
	id,
	settings,
}: {
	id: string;
	settings: AppearanceSettings;
}) {
	const scheme = useEditedScheme(settings.theme);
	return (
		<div className="flex items-center gap-3 @lg:justify-self-end">
			<input
				id={id}
				type="color"
				value={settings.accent ?? resolveHex(settings, scheme, "primary")}
				onChange={(event) => updateAppearance({ accent: event.target.value })}
				className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
			/>
			{settings.accent ? (
				<Button
					size="sm"
					variant="ghost"
					onClick={() => updateAppearance({ accent: null })}
				>
					Reset accent
				</Button>
			) : (
				<span className="text-sm text-muted-foreground">Default</span>
			)}
		</div>
	);
}
