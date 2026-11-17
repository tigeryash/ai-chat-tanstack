import { Switch } from "@/components/ui/switch";
import {
	type ChatPrefs,
	INLINE_STATS,
	type InlineStats,
	REASONING_STARTS,
	type ReasoningStart,
	updateChatPrefs,
	useChatPrefs,
} from "@/lib/chat/chat-prefs";
import { Choice } from "./setting-choice";
import type { SettingControlProps } from "./setting-row-props";

// Settings → Chat (roadmap R2 S4 and S10).

const INLINE_STATS_LABELS: Record<InlineStats, string> = {
	none: "None",
	cost: "Cost",
	all: "All",
};

const REASONING_LABELS: Record<ReasoningStart, string> = {
	"while-thinking": "Open while thinking",
	open: "Always open",
	closed: "Closed",
};

type SwitchPref = "contextWarnings" | "syncScroll" | "newPanesSynced";

function PrefSwitch({
	pref,
	controlId,
	descriptionId,
}: SettingControlProps & { pref: SwitchPref }) {
	const prefs: ChatPrefs = useChatPrefs();
	return (
		<Switch
			id={controlId}
			aria-describedby={descriptionId}
			checked={prefs[pref]}
			onCheckedChange={(checked) => updateChatPrefs({ [pref]: checked })}
			className="@lg:justify-self-end"
		/>
	);
}

export function ContextWarningsSwitch(props: SettingControlProps) {
	return <PrefSwitch {...props} pref="contextWarnings" />;
}

export function SyncScrollDefaultSwitch(props: SettingControlProps) {
	return <PrefSwitch {...props} pref="syncScroll" />;
}

export function NewPanesSyncedSwitch(props: SettingControlProps) {
	return <PrefSwitch {...props} pref="newPanesSynced" />;
}

export function InlineStatsChoice(props: SettingControlProps) {
	const { inlineStats } = useChatPrefs();
	return (
		<Choice
			{...props}
			options={INLINE_STATS}
			labels={INLINE_STATS_LABELS}
			value={inlineStats}
			onChange={(next) => updateChatPrefs({ inlineStats: next })}
		/>
	);
}

export function ReasoningStartChoice(props: SettingControlProps) {
	const { reasoning } = useChatPrefs();
	return (
		<Choice
			{...props}
			options={REASONING_STARTS}
			labels={REASONING_LABELS}
			value={reasoning}
			onChange={(next) => updateChatPrefs({ reasoning: next })}
		/>
	);
}
