import { useId } from "react";
import { Label } from "@/components/ui/label";
import type { FontOption } from "@/lib/appearance/fonts";

/** A native select (keyboard and screen-reader friendly everywhere); each option in its own font. */
export function FontSelect<T extends readonly FontOption[]>({
	label,
	fonts,
	value,
	onChange,
}: {
	label: string;
	fonts: T;
	value: T[number]["id"];
	onChange: (id: T[number]["id"]) => void;
}) {
	const id = useId();
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<select
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				{fonts.map((font) => (
					<option
						key={font.id}
						value={font.id}
						style={font.stack ? { fontFamily: font.stack } : undefined}
					>
						{font.label}
					</option>
				))}
			</select>
		</div>
	);
}
