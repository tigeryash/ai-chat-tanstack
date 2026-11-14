import type { SkipReason } from "@/lib/hosts/host-options";

// Marks a host or upstream that Auto passes over under the host preferences (roadmap R2 S3,
// Settings → Models & hosts). Pinning it still runs, so it's a badge, not a disabled row.

const SKIP_LABELS: Record<SkipReason, string> = {
	blocked: "Blocked",
	precision: "Quantized",
	price: "Over price cap",
};

const SKIP_TITLES: Record<SkipReason, string> = {
	blocked: "On your blocklist. Auto skips it; you can still pick it.",
	precision:
		"Below your minimum precision. Auto skips it; you can still pick it.",
	price: "Above your price cap for Auto. You can still pick it.",
};

export function SkipBadge({ reason }: { reason: SkipReason | undefined }) {
	if (!reason) return null;
	return (
		<span
			data-skipped={reason}
			title={SKIP_TITLES[reason]}
			className="shrink-0 rounded border border-dashed px-1 text-[0.65rem] text-muted-foreground"
		>
			{SKIP_LABELS[reason]}
		</span>
	);
}
