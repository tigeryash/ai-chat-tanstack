import { Badge } from "@/components/ui/badge";
import { CAPABILITY_LABELS, capabilitiesOf } from "@/lib/models/capabilities";
import type { CatalogModel } from "@/lib/models/catalog";

// Badges for the model picker and card (roadmap 2.2).

export function HighEloBadge() {
	return (
		<Badge variant="default" className="h-4 px-1.5 text-[0.65rem]">
			High Elo
		</Badge>
	);
}

export function CapabilityBadges({
	model,
}: {
	model: Pick<CatalogModel, "tags" | "inputModalities">;
}) {
	const capabilities = capabilitiesOf(model);
	if (capabilities.length === 0) return null;
	return (
		<span className="flex flex-wrap gap-1">
			{capabilities.map((capability) => (
				<Badge
					key={capability}
					variant="outline"
					className="h-4 px-1.5 font-normal text-[0.65rem] text-muted-foreground"
				>
					{CAPABILITY_LABELS[capability]}
				</Badge>
			))}
		</span>
	);
}

const COVERAGE_TEXT = {
	all: "",
	some: " on some providers",
	none: "",
} as const;

/** Zero data retention and no-training, from the Gateway's provider flags. */
export function DataPolicyBadges({
	model,
}: {
	model: Pick<CatalogModel, "zdr" | "noTraining">;
}) {
	const badges = [
		model.zdr !== "none" && `Zero data retention${COVERAGE_TEXT[model.zdr]}`,
		model.noTraining !== "none" &&
			`No training on prompts${COVERAGE_TEXT[model.noTraining]}`,
	].filter((text): text is string => Boolean(text));
	if (badges.length === 0) return null;
	return (
		<span className="flex flex-wrap gap-1.5">
			{badges.map((text) => (
				<Badge key={text} variant="secondary">
					{text}
				</Badge>
			))}
		</span>
	);
}
