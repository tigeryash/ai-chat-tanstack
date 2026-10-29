import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	requestNotificationAccess,
	useNotificationAccess,
} from "@/lib/background-status/notifications";
import {
	type BackgroundStatusSettings as Settings,
	updateBackgroundStatusSettings,
	useBackgroundStatusSettings,
} from "@/lib/background-status/settings";

/** Settings → Background status (roadmap 3.10): tab title and notifications while the tab is hidden. */
export function BackgroundStatusSettings() {
	const settings = useBackgroundStatusSettings();
	const toggle = (key: keyof Settings) => (checked: boolean) =>
		updateBackgroundStatusSettings({ [key]: checked });

	return (
		<section aria-labelledby="background-status" className="mt-10 grid gap-4">
			<header className="grid gap-2">
				<h2 id="background-status" className="font-semibold">
					Background status
				</h2>
				<p className="max-w-2xl text-sm text-muted-foreground">
					When this tab is in the background, show how replies are going. Only
					counts and the chat's name are shown, never what's in a chat.
				</p>
			</header>
			<SettingSwitch
				label="Show reply status in the tab title"
				checked={settings.tabStatus}
				onChange={toggle("tabStatus")}
			/>
			<SettingSwitch
				label="Notify me when a reply is ready"
				checked={settings.notifyFinished}
				onChange={toggle("notifyFinished")}
			/>
			<SettingSwitch
				label="Notify me when a reply fails"
				checked={settings.notifyFailed}
				onChange={toggle("notifyFailed")}
			/>
			<NotificationPermission />
		</section>
	);
}

function SettingSwitch({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	const id = useId();
	return (
		<div className="flex items-center gap-3">
			<Switch id={id} checked={checked} onCheckedChange={onChange} />
			<label htmlFor={id} className="text-sm">
				{label}
			</label>
		</div>
	);
}

function NotificationPermission() {
	const access = useNotificationAccess();
	const [asking, setAsking] = useState(false);

	if (access === "granted") {
		return (
			<p className="text-sm text-muted-foreground">
				Notifications are allowed in this browser.
			</p>
		);
	}
	if (access === "unsupported") {
		return (
			<p className="text-sm text-muted-foreground">
				This browser can't show notifications.
			</p>
		);
	}
	if (access === "denied") {
		return (
			<p className="text-sm text-muted-foreground">
				Notifications are blocked for this site. Allow them in your browser's
				site settings to get them.
			</p>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Button
				size="sm"
				variant="outline"
				disabled={asking}
				onClick={async () => {
					setAsking(true);
					updateBackgroundStatusSettings({ askedPermission: true });
					await requestNotificationAccess();
					setAsking(false);
				}}
			>
				Allow notifications
			</Button>
			<span className="text-sm text-muted-foreground">
				Your browser will ask to confirm.
			</span>
		</div>
	);
}
