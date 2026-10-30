import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import {
	MAX_STOP_SEQUENCE_LENGTH,
	MAX_STOP_SEQUENCES,
	type NumberParam,
	PARAMS,
	type ParamId,
	type SelectParam,
} from "@/lib/params/registry";
import type { ParamValues } from "@/lib/params/settings";
import type { ParamSupport } from "@/lib/params/support";

// One control per registry entry (roadmap 2.4b). Unset values show "Default" and aren't sent.

const FIELD =
	"w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface ControlProps<T> {
	value: T | undefined;
	onChange: (value: T | undefined) => void;
}

function inRange(param: NumberParam, value: number) {
	return (
		Number.isFinite(value) &&
		value >= param.min &&
		value <= param.max &&
		(!param.integer || Number.isInteger(value))
	);
}

function NumberControl({
	param,
	value,
	onChange,
	describedBy,
}: ControlProps<number> & { param: NumberParam; describedBy: string }) {
	const [draft, setDraft] = useState<string | undefined>(undefined);
	const text = draft ?? (value === undefined ? "" : String(value));
	const invalid =
		draft !== undefined && draft !== "" && !inRange(param, Number(draft));
	const commit = (next: string) => {
		setDraft(next);
		if (next.trim() === "") onChange(undefined);
		else if (inRange(param, Number(next))) onChange(Number(next));
	};
	return (
		<div className="flex items-center gap-2">
			{param.control === "slider" && (
				<input
					type="range"
					aria-label={param.label}
					aria-describedby={describedBy}
					className="flex-1 accent-primary"
					min={param.min}
					max={param.max}
					step={param.step}
					value={value ?? param.default}
					onChange={(event) => {
						setDraft(undefined);
						onChange(Number(event.target.value));
					}}
				/>
			)}
			<Input
				type="number"
				inputMode="decimal"
				aria-label={
					param.control === "slider" ? `${param.label} value` : param.label
				}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				className={param.control === "slider" ? "w-20" : undefined}
				placeholder="Default"
				min={param.min}
				max={param.max}
				step={param.step}
				value={text}
				onChange={(event) => commit(event.target.value)}
				onBlur={() => setDraft(undefined)}
			/>
		</div>
	);
}

function SelectControl({
	param,
	options,
	value,
	onChange,
	describedBy,
}: ControlProps<string> & {
	param: SelectParam;
	options: readonly string[];
	describedBy: string;
}) {
	return (
		<select
			aria-label={param.label}
			aria-describedby={describedBy}
			className={FIELD}
			value={value ?? ""}
			onChange={(event) => onChange(event.target.value || undefined)}
		>
			<option value="">Default</option>
			{options.map((option) => (
				<option key={option} value={option}>
					{option}
				</option>
			))}
		</select>
	);
}

function StopControl({
	value,
	onChange,
	describedBy,
}: ControlProps<string[]> & { describedBy: string }) {
	const [draft, setDraft] = useState<string | undefined>(undefined);
	return (
		<textarea
			aria-label={PARAMS.stopSequences.label}
			aria-describedby={describedBy}
			rows={2}
			className={FIELD}
			value={draft ?? (value ?? []).join("\n")}
			onChange={(event) => {
				setDraft(event.target.value);
				const lines = event.target.value
					.split("\n")
					.filter((line) => line !== "")
					.slice(0, MAX_STOP_SEQUENCES)
					.map((line) => line.slice(0, MAX_STOP_SEQUENCE_LENGTH));
				onChange(lines.length > 0 ? lines : undefined);
			}}
			onBlur={() => setDraft(undefined)}
		/>
	);
}

export function ParamControl({
	id,
	support,
	values,
	onChange,
}: {
	id: ParamId;
	support: ParamSupport;
	values: ParamValues;
	onChange: <K extends ParamId>(
		id: K,
		value: ParamValues[K] | undefined,
	) => void;
}) {
	const helpId = useId();
	const param = PARAMS[id];
	let control: React.ReactNode;
	if (param.control === "stop") {
		control = (
			<StopControl
				value={values.stopSequences}
				onChange={(value) => onChange("stopSequences", value)}
				describedBy={helpId}
			/>
		);
	} else if (param.control === "select") {
		const options =
			id === "reasoningEffort" ? support.reasoningEfforts : param.options;
		control = (
			<SelectControl
				param={param}
				options={options}
				value={values[id as "reasoningEffort" | "verbosity"]}
				onChange={(value) =>
					onChange(id as "reasoningEffort" | "verbosity", value as never)
				}
				describedBy={helpId}
			/>
		);
	} else {
		const range =
			id === "reasoningBudget" ? support.reasoningBudget : undefined;
		const numberParam = range ? { ...param, ...range } : param;
		control = (
			<NumberControl
				param={numberParam}
				value={values[id as keyof ParamValues] as number | undefined}
				onChange={(value) => onChange(id, value as never)}
				describedBy={helpId}
			/>
		);
	}
	return (
		<div className="flex flex-col gap-1.5" data-param={id}>
			<span className="font-medium text-sm">{param.label}</span>
			{control}
			<p id={helpId} className="text-muted-foreground text-xs">
				{param.help}
			</p>
		</div>
	);
}
