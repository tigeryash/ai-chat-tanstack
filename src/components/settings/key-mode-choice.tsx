import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { KeyMode } from "@/lib/keys";

const MODES: { value: KeyMode; label: string; hint: string }[] = [
	{
		value: "remember",
		label: "Remember on this device",
		hint: "Encrypted in this browser. That protects a copied browser profile, not a malicious script on this page.",
	},
	{
		value: "session",
		label: "This session only",
		hint: "Kept in memory and gone when you reload or close the tab.",
	},
];

export function KeyModeChoice({
	value,
	onChange,
}: {
	value: KeyMode;
	onChange: (mode: KeyMode) => void;
}) {
	const id = useId();
	return (
		<RadioGroup
			aria-label="Where to keep the key"
			value={value}
			onValueChange={(next) => onChange(next as KeyMode)}
			className="gap-2"
		>
			{MODES.map((mode) => (
				<div key={mode.value} className="flex items-start gap-2">
					<RadioGroupItem
						id={`${id}-${mode.value}`}
						value={mode.value}
						aria-describedby={`${id}-${mode.value}-hint`}
						className="mt-0.5"
					/>
					<div className="grid gap-1">
						<Label htmlFor={`${id}-${mode.value}`}>{mode.label}</Label>
						<p
							id={`${id}-${mode.value}-hint`}
							className="text-xs text-muted-foreground"
						>
							{mode.hint}
						</p>
					</div>
				</div>
			))}
		</RadioGroup>
	);
}
