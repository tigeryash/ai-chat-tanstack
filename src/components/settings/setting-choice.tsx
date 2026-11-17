import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SettingControlProps } from "./setting-row-props";

/** A settings row's choice of a few options, as radio buttons labelled by the row. */
export function Choice<T extends string>({
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
