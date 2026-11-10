import { Switch } from "@/components/ui/switch";
import { updateChatPrefs, useChatPrefs } from "@/lib/chat/chat-prefs";
import type { SettingControlProps } from "./setting-row-props";

// Settings → Chat (roadmap R2 S4).

export function ContextWarningsSwitch({
	controlId,
	descriptionId,
}: SettingControlProps) {
	const { contextWarnings } = useChatPrefs();
	return (
		<Switch
			id={controlId}
			aria-describedby={descriptionId}
			checked={contextWarnings}
			onCheckedChange={(checked) =>
				updateChatPrefs({ contextWarnings: checked })
			}
			className="@lg:justify-self-end"
		/>
	);
}
