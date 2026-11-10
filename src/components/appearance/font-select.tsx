import type { FontOption } from "@/lib/appearance/fonts";

/** A native select (keyboard and screen-reader friendly everywhere); each option in its own font. */
export function FontSelect<T extends readonly FontOption[]>({
	id,
	fonts,
	value,
	onChange,
}: {
	id: string;
	fonts: T;
	value: T[number]["id"];
	onChange: (id: T[number]["id"]) => void;
}) {
	return (
		<select
			id={id}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className="h-9 w-48 rounded-md @lg:justify-self-end border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
	);
}
