import { useId } from "react";
import type { Shortcut } from "@/lib/commands/command";
import {
	keysOf,
	SHORTCUT_AREAS,
	SHORTCUTS,
	type ShortcutBinding,
} from "@/lib/commands/keymap";
import {
	isApplePlatform,
	shortcutKeys,
	shortcutLabel,
} from "@/lib/commands/shortcut";

// Every shortcut in the keymap, grouped by area (roadmap R2 S6): the shortcut sheet and Settings →
// Keyboard both show this, read-only. ⌘ on a Mac, Ctrl elsewhere.

function Keys({ shortcut, apple }: { shortcut: Shortcut; apple: boolean }) {
	return (
		<kbd
			aria-label={shortcutLabel(shortcut, apple)}
			className="flex shrink-0 gap-0.5 font-sans text-muted-foreground text-xs"
		>
			{shortcutKeys(shortcut, apple).map((key) => (
				<span
					key={key}
					aria-hidden
					className="min-w-5 rounded border bg-muted px-1 text-center"
				>
					{key}
				</span>
			))}
		</kbd>
	);
}

function Row({ binding, apple }: { binding: ShortcutBinding; apple: boolean }) {
	return (
		<li
			data-shortcut={binding.id}
			className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
		>
			<span className="min-w-0">{binding.title}</span>
			<span className="flex items-center gap-1.5">
				<Keys shortcut={keysOf(binding, apple)} apple={apple} />
				{binding.alt && (
					<>
						<span className="text-muted-foreground text-xs">or</span>
						<Keys shortcut={binding.alt} apple={apple} />
					</>
				)}
			</span>
		</li>
	);
}

function Area({
	label,
	bindings,
	apple,
}: {
	label: string;
	bindings: readonly ShortcutBinding[];
	apple: boolean;
}) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className="grid gap-2">
			<h3 id={headingId} className="px-1 font-medium text-sm">
				{label}
			</h3>
			<ul className="divide-y overflow-hidden rounded-lg border bg-card text-card-foreground">
				{bindings.map((binding) => (
					<Row key={binding.id} binding={binding} apple={apple} />
				))}
			</ul>
		</section>
	);
}

const IN_FIELDS = SHORTCUTS.filter((binding) => binding.inFields)
	.map((binding) => binding.title)
	.join(", ");

export function ShortcutList() {
	const apple = isApplePlatform();
	return (
		<div className="grid gap-6">
			{SHORTCUT_AREAS.map((area) => (
				<Area
					key={area.id}
					label={area.label}
					bindings={SHORTCUTS.filter((binding) => binding.area === area.id)}
					apple={apple}
				/>
			))}
			<p className="px-1 text-muted-foreground text-sm">
				While you type in a text field, only these work: {IN_FIELDS}.
			</p>
		</div>
	);
}
