import type { HostHealth } from "@/lib/hosts/endpoint-stats";
import { cn } from "@/lib/utils";

// A host's status light (roadmap 2.2b). Color is never the only signal: the label is always in the
// accessible name, and also shown as a tooltip.

export type LightState = HostHealth | "not-connected";

export const LIGHT_LABELS: Record<LightState, string> = {
	up: "Up",
	slow: "Slow or flaky lately",
	down: "Down or failing",
	unknown: "No live status",
	"not-connected": "Not connected",
};

const LIGHT_CLASSES: Record<LightState, string> = {
	up: "bg-success",
	slow: "bg-warning",
	down: "bg-destructive",
	unknown: "border border-muted-foreground/60 bg-transparent",
	"not-connected": "bg-muted-foreground/40",
};

export function lightState(health: HostHealth, connected: boolean): LightState {
	return connected ? health : "not-connected";
}

export function HostLight({
	state,
	className,
}: {
	state: LightState;
	className?: string;
}) {
	const label = LIGHT_LABELS[state];
	return (
		<span
			title={label}
			data-light={state}
			className={cn("inline-flex shrink-0 items-center", className)}
		>
			<span
				aria-hidden="true"
				className={cn("size-2 rounded-full", LIGHT_CLASSES[state])}
			/>
			<span className="sr-only">{label}</span>
		</span>
	);
}
