import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	type AppearanceSettings,
	exportAppearance,
	importAppearance,
} from "@/lib/appearance/schema";
import { appearanceSettings } from "@/lib/appearance/store";

/** A theme as a JSON file: export to share or keep it, import to restore it. */
export function ThemeFile({ settings }: { settings: AppearanceSettings }) {
	const input = useRef<HTMLInputElement>(null);
	const [message, setMessage] = useState<{
		error: boolean;
		text: string;
	} | null>(null);

	const download = () => {
		const blob = new Blob([exportAppearance(settings)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "high-elo-llms-appearance.json";
		link.click();
		URL.revokeObjectURL(url);
	};

	const upload = async (file: File | undefined) => {
		if (!file) return;
		const result = importAppearance(await file.text());
		if (result.ok) {
			appearanceSettings.write(result.settings);
			setMessage({ error: false, text: "Theme imported." });
		} else {
			setMessage({ error: true, text: result.error });
		}
	};

	return (
		<>
			<Button size="sm" variant="outline" onClick={download}>
				Export theme
			</Button>
			<Button
				size="sm"
				variant="outline"
				onClick={() => input.current?.click()}
			>
				Import theme
			</Button>
			<input
				ref={input}
				type="file"
				accept="application/json,.json"
				aria-label="Theme file to import"
				className="hidden"
				onChange={(event) => {
					void upload(event.target.files?.[0]);
					event.target.value = "";
				}}
			/>
			{message && (
				<span
					role={message.error ? "alert" : "status"}
					className={
						message.error
							? "text-sm text-destructive"
							: "text-sm text-muted-foreground"
					}
				>
					{message.text}
				</span>
			)}
		</>
	);
}
