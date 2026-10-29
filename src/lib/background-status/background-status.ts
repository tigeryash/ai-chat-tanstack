import {
	type ReplyEnded,
	replyingCount,
	subscribeReplyEnded,
	subscribeReplying,
} from "./activity";
import { notificationAccess, showReplyNotification } from "./notifications";
import {
	backgroundStatusSettings,
	updateBackgroundStatusSettings,
} from "./settings";
import { formatTabTitle, statusFaviconUrl, tabState } from "./tab-title";

// While the tab is hidden, its title and favicon follow reply activity across all chats, and replies
// that end send a notification (roadmap 3.10). Nothing changes while the tab is visible; showing it
// again restores the normal title and icon.

export interface BackgroundStatusOptions {
	/** Opens a chat, when the person clicks its notification. */
	openChat: (chatId: string) => void;
	/** The chat's title, or "" when it has none. */
	chatTitle: (chatId: string) => Promise<string>;
	/** The person came back after leaving a reply running for the first time: offer notifications. */
	offerNotifications: () => void;
	/** Read when the pulse would start, so the OS setting applies live. */
	prefersReducedMotion: () => boolean;
}

/** The pulse while replying: two frames, a second each (background tabs run timers about once a second). */
const PULSE_MS = 1000;
const DEFAULT_ICON = "/favicon.ico";

export function startBackgroundStatus(
	options: BackgroundStatusOptions,
): () => void {
	let hidden = false;
	let finished = 0;
	let failed = 0;
	let baseTitle = document.title;
	let favicon: ReturnType<typeof takeOverFavicon> | undefined;
	let pulse: ReturnType<typeof setInterval> | undefined;
	let offerPending = false;

	const stopPulse = () => {
		clearInterval(pulse);
		pulse = undefined;
	};

	const render = () => {
		if (!hidden || !backgroundStatusSettings.read().tabStatus) return;
		const activity = { replying: replyingCount(), finished, failed };
		document.title = formatTabTitle(activity, baseTitle);
		const state = tabState(activity);
		// A reply stopped from another pane: nothing left to show.
		if (state === "idle") return restore();
		favicon ??= takeOverFavicon();
		const { icon } = favicon;
		icon.href = statusFaviconUrl(state);
		if (state !== "replying") {
			stopPulse();
		} else if (!pulse && !options.prefersReducedMotion()) {
			let dim = false;
			pulse = setInterval(() => {
				dim = !dim;
				icon.href = statusFaviconUrl("replying", dim);
			}, PULSE_MS);
		}
	};

	const restore = () => {
		stopPulse();
		if (document.title !== baseTitle) document.title = baseTitle;
		favicon?.restore();
		favicon = undefined;
	};

	const onVisibilityChange = () => {
		if (document.hidden === hidden) return;
		hidden = document.hidden;
		if (hidden) {
			baseTitle = document.title;
			finished = 0;
			failed = 0;
			offerPending ||= shouldOfferNotifications();
			render();
			return;
		}
		restore();
		if (offerPending) {
			offerPending = false;
			updateBackgroundStatusSettings({ askedPermission: true });
			options.offerNotifications();
		}
	};

	const onReplyEnded = ({ chatId, outcome }: ReplyEnded) => {
		if (!hidden) return;
		if (outcome === "finished") finished += 1;
		else failed += 1;
		render();
		const settings = backgroundStatusSettings.read();
		const wanted =
			outcome === "finished" ? settings.notifyFinished : settings.notifyFailed;
		if (!wanted || notificationAccess() !== "granted") return;
		options
			.chatTitle(chatId)
			.catch(() => "")
			.then((title) =>
				showReplyNotification(outcome, chatId, title, () =>
					options.openChat(chatId),
				),
			);
	};

	const onReplyingChange = () => {
		if (hidden) offerPending ||= shouldOfferNotifications();
		render();
	};

	const stopReplying = subscribeReplying(onReplyingChange);
	const stopEnded = subscribeReplyEnded(onReplyEnded);
	document.addEventListener("visibilitychange", onVisibilityChange);
	onVisibilityChange();

	return () => {
		stopReplying();
		stopEnded();
		document.removeEventListener("visibilitychange", onVisibilityChange);
		restore();
	};
}

/**
 * Offer once: the first time a reply runs while the tab is hidden (the person left it running), if
 * notifications are still undecided.
 */
function shouldOfferNotifications(): boolean {
	const settings = backgroundStatusSettings.read();
	return (
		replyingCount() > 0 &&
		!settings.askedPermission &&
		(settings.notifyFinished || settings.notifyFailed) &&
		notificationAccess() === "default"
	);
}

/** The page's icon link (made if there is none) and a way to put its icon back. */
function takeOverFavicon() {
	const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
	const icon = existing ?? document.createElement("link");
	const original = existing?.getAttribute("href") ?? DEFAULT_ICON;
	if (!existing) {
		icon.rel = "icon";
		document.head.append(icon);
	}
	return {
		icon,
		restore: () => icon.setAttribute("href", original),
	};
}
