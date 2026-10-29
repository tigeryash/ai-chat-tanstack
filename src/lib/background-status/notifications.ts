import { useSyncExternalStore } from "react";
import { logWarn } from "@/lib/log";
import type { ReplyOutcome } from "./activity";

// Browser notifications for replies that end while the tab is hidden (roadmap 3.10). Privacy rule
// (hard rule 4, decision 23): a notification names the chat at most, never what's in it.

export type NotificationAccess = NotificationPermission | "unsupported";

const listeners = new Set<() => void>();

export function notificationAccess(): NotificationAccess {
	return typeof Notification === "undefined"
		? "unsupported"
		: Notification.permission;
}

/** Shows the browser's prompt. Call from a click, after our own explainer. */
export async function requestNotificationAccess(): Promise<NotificationAccess> {
	if (typeof Notification === "undefined") return "unsupported";
	try {
		await Notification.requestPermission();
	} catch (error) {
		logWarn("Couldn't ask for notification permission:", error);
	}
	for (const listener of listeners) listener();
	return Notification.permission;
}

export function useNotificationAccess(): NotificationAccess {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		notificationAccess,
		() => "unsupported",
	);
}

/** "Reply ready in Trip planning", or just "Reply ready" for a chat without a title yet. */
export function notificationText(
	outcome: ReplyOutcome,
	chatTitle: string,
): string {
	const lead = outcome === "finished" ? "Reply ready" : "Reply failed";
	const title = chatTitle.trim();
	return title ? `${lead} in ${title}` : lead;
}

/** Shows a notification for a reply; clicking it calls `onClick`. Does nothing without permission. */
export function showReplyNotification(
	outcome: ReplyOutcome,
	chatId: string,
	chatTitle: string,
	onClick: () => void,
): void {
	if (notificationAccess() !== "granted") return;
	try {
		const notification = new Notification(
			notificationText(outcome, chatTitle),
			{
				// One notification per chat: a newer one replaces the last.
				tag: `chat-${chatId}`,
			},
		);
		notification.onclick = () => {
			window.focus();
			onClick();
			notification.close();
		};
	} catch (error) {
		// Android Chrome only allows notifications from a service worker.
		logWarn("Couldn't show a notification:", error);
	}
}
