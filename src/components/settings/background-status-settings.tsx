import { useState } from "react";
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
import type { SettingControlProps } from "./setting-row-props";

/** A switch for one background-status setting, labelled by its settings row. */
function BackgroundStatusSwitch({
	setting,
	controlId,
	descriptionId,
}: SettingControlProps & { setting: ToggleKey }) {
	const settings = useBackgroundStatusSettings();
	return (
		<Switch
			id={controlId}
			aria-describedby={descriptionId}
			checked={settings[setting]}
			onCheckedChange={(checked) =>
				updateBackgroundStatusSettings({ [setting]: checked })
			}
			className="@lg:justify-self-end"
		/>
	);
}

type ToggleKey = keyof Pick<
	Settings,
	"tabStatus" | "notifyFinished" | "notifyFailed"
>;

// Settings → Notifications (roadmap 3.10, moved into the Settings dialog in R2 S1): tab title and
// notifications while the tab is hidden.
export function TabStatusSwitch(props: SettingControlProps) {
	return <BackgroundStatusSwitch {...props} setting="tabStatus" />;
}

export function NotifyFinishedSwitch(props: SettingControlProps) {
	return <BackgroundStatusSwitch {...props} setting="notifyFinished" />;
}

export function NotifyFailedSwitch(props: SettingControlProps) {
	return <BackgroundStatusSwitch {...props} setting="notifyFailed" />;
}

export function NotificationPermission() {
	const access = useNotificationAccess();
	const [asking, setAsking] = useState(false);

	if (access === "granted") {
		return (
			<p className="text-sm text-muted-foreground @lg:text-right">
				Notifications are allowed in this browser.
			</p>
		);
	}
	if (access === "unsupported") {
		return (
			<p className="text-sm text-muted-foreground @lg:text-right">
				This browser can't show notifications.
			</p>
		);
	}
	if (access === "denied") {
		return (
			<p className="max-w-xs text-sm text-muted-foreground @lg:text-right">
				Notifications are blocked for this site. Allow them in your browser's
				site settings to get them.
			</p>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-3 @lg:justify-end">
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
export function TestNotification() {
	const access = useNotificationAccess();
	const [result, setResult] = useState<TestNotificationResult | null>(null);
	const [sending, setSending] = useState(false);
	if (access === "unsupported") return null;

	return (
		<>
			<div className="@lg:justify-self-end">
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
			</div>
			<span
				role="status"
				className="col-span-full text-sm text-muted-foreground empty:hidden"
			>
				{result && TEST_RESULT_TEXT[result]}
			</span>
			{result && result !== "unsupported" && (
				<div
					role="note"
					aria-label="If notifications don't appear"
					className="col-span-full max-w-2xl text-sm text-muted-foreground"
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
		</>
	);
}
