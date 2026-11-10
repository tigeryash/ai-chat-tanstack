import { type ReactNode, useId } from "react";
import { Button } from "@/components/ui/button";
import {
	cardsInSection,
	type SettingId,
	type SettingsCard,
	visibleSettingsSections,
} from "@/lib/settings/registry";
import type { SettingsSectionId } from "@/lib/settings/sections";
import { SECTION_UPCOMING } from "@/lib/settings/upcoming";
import { SettingRow } from "./setting-row";

/** One section of Settings: its cards of rows, or what's coming when it has none yet. */
export function SettingsSectionBody({
	section,
	highlighted,
	onSelect,
}: {
	section: SettingsSectionId;
	highlighted: SettingId | null;
	onSelect: (section: SettingsSectionId) => void;
}) {
	const cards = cardsInSection(section);
	if (cards.length === 0) {
		return <EmptySection section={section} onSelect={onSelect} />;
	}
	return (
		<div className="grid gap-6">
			{cards.map(({ card, rows }) => (
				<Card key={card.id} card={card}>
					{rows.map((setting) => (
						<SettingRow
							key={setting.id}
							setting={setting}
							highlighted={highlighted === setting.id}
						/>
					))}
				</Card>
			))}
		</div>
	);
}

function Card({ card, children }: { card: SettingsCard; children: ReactNode }) {
	const titleId = useId();
	const rows = (
		<div className="divide-y overflow-hidden rounded-lg border bg-card text-card-foreground">
			{children}
		</div>
	);
	if (!card.title) return rows;
	return (
		<section aria-labelledby={titleId} className="grid gap-2">
			<div className="grid gap-1 px-1">
				<h3 id={titleId} className="font-medium text-sm">
					{card.title}
				</h3>
				{card.description && (
					<p className="max-w-prose text-muted-foreground text-sm">
						{card.description}
					</p>
				)}
			</div>
			{rows}
		</section>
	);
}

/** An honest empty state: nothing to set here yet, what's coming, and where the settings that exist are. */
function EmptySection({
	section,
	onSelect,
}: {
	section: SettingsSectionId;
	onSelect: (section: SettingsSectionId) => void;
}) {
	const others = visibleSettingsSections().filter(
		(other) => other.id !== section && other.id !== "general",
	);
	return (
		<div className="grid gap-4 rounded-lg border bg-card p-4 text-card-foreground">
			<div className="grid gap-1">
				<p className="font-medium text-sm">Nothing to set here yet</p>
				<p className="text-muted-foreground text-sm">
					Coming here: {SECTION_UPCOMING[section]}
				</p>
			</div>
			<div className="grid gap-2">
				<p className="text-muted-foreground text-sm">
					Settings you can change now:
				</p>
				<ul className="flex flex-wrap gap-2">
					{others.map((other) => (
						<li key={other.id}>
							<Button
								size="sm"
								variant="outline"
								onClick={() => onSelect(other.id)}
							>
								{other.label}
							</Button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
