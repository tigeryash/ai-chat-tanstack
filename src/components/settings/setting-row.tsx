import { useId } from "react";
import type { Setting, SettingId } from "@/lib/settings/registry";
import { cn } from "@/lib/utils";
import { SETTING_CONTROLS } from "./setting-controls";

/** The DOM id of a setting's row, for search results to scroll to. */
export function settingRowId(id: SettingId): string {
	return `setting-${id}`;
}

/**
 * One row of a settings card: the label and description, and the control. Inline rows put the control
 * to the right when there's room (a container query, so the phone sheet stacks them); block rows put
 * it below. A block row is a region named by its label.
 */
export function SettingRow({
	setting,
	highlighted,
}: {
	setting: Setting;
	highlighted: boolean;
}) {
	const id = useId();
	const ids = {
		controlId: `${id}control`,
		labelId: `${id}label`,
		descriptionId: `${id}description`,
	};
	const Control = SETTING_CONTROLS[setting.id];
	const block = setting.layout === "block";
	const Row = block ? "section" : "div";

	return (
		<Row
			id={settingRowId(setting.id)}
			aria-labelledby={block ? ids.labelId : undefined}
			data-highlighted={highlighted || undefined}
			tabIndex={-1}
			className={cn(
				"grid gap-x-6 gap-y-3 p-4 outline-none transition-colors duration-300 data-highlighted:bg-accent",
				!block && "@lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-center",
			)}
		>
			<div className="grid min-w-0 gap-1">
				{block ? (
					<h3 id={ids.labelId} className="font-medium text-sm">
						{setting.label}
					</h3>
				) : (
					<label
						id={ids.labelId}
						htmlFor={ids.controlId}
						className="font-medium text-sm"
					>
						{setting.label}
					</label>
				)}
				<p
					id={ids.descriptionId}
					className="max-w-prose text-muted-foreground text-sm"
				>
					{setting.description}
				</p>
			</div>
			<Control {...ids} />
		</Row>
	);
}
