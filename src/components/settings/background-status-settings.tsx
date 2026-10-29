import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	requestNotificationAccess,
	showTestNotification,
	type TestNotificationResult,
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
			<TestNotification />
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

const TEST_RESULT_TEXT: Record<TestNotificationResult, string> = {
	sent: "Sent. If nothing appeared, your system or browser is hiding it.",
	blocked: "Notifications are blocked, so nothing could be shown.",
	unsupported: "This browser can't show notifications.",
	failed: "The browser refused to show a notification here.",
};

/** Sends a fixed test notification, and says where to look when it doesn't appear. */
function TestNotification() {
	const access = useNotificationAccess();
	const [result, setResult] = useState<TestNotificationResult | null>(null);
	const [sending, setSending] = useState(false);
	if (access === "unsupported") return null;

	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap items-center gap-3">
				<Button
					size="sm"
					variant="outline"
					disabled={sending}
					onClick={async () => {
						setSending(true);
						updateBackgroundStatusSettings({ askedPermission: true });
						setResult(await showTestNotification());
						setSending(false);
					}}
				>
					Send test notification
				</Button>
				<span role="status" className="text-sm text-muted-foreground">
					{result && TEST_RESULT_TEXT[result]}
				</span>
			</div>
			{result && result !== "unsupported" && (
				<div
					role="note"
					aria-label="If notifications don't appear"
					className="max-w-2xl text-sm text-muted-foreground"
				>
					<p>If notifications don't appear:</p>
					<ul className="mt-1 list-disc pl-5">
						<li>
							On a Mac, open System Settings → Notifications, pick your browser,
							and turn on Allow notifications.
						</li>
						<li>Check that Focus or Do Not Disturb is off.</li>
						<li>
							Check this site's notification permission in your browser (the
							icon left of the address bar, then Site settings).
						</li>
					</ul>
				</div>
			)}
		</div>
	);
}
