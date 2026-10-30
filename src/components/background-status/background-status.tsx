import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { startBackgroundStatus } from "@/lib/background-status/background-status";
import {
	type NotificationAccess,
	requestNotificationAccess,
} from "@/lib/background-status/notifications";
import { REDUCED_MOTION } from "@/lib/reduced-motion";
import { chatStore } from "@/lib/storage/app-store";

/**
 * Tab status and reply notifications while the tab is hidden (roadmap 3.10), plus our one-time offer
 * to turn notifications on. Mounted once in the app layout. Renders nothing until that offer is due.
 */
export function BackgroundStatus() {
	const navigate = useNavigate();
	const [offer, setOffer] = useState<"open" | "denied" | "closed">("closed");

	useEffect(
		() =>
			startBackgroundStatus({
				openChat: (chatId) =>
					void navigate({ to: "/$chatId", params: { chatId } }),
				chatTitle: async (chatId) =>
					(await chatStore().getChat(chatId))?.title ?? "",
				offerNotifications: () => setOffer("open"),
				prefersReducedMotion: () => window.matchMedia(REDUCED_MOTION).matches,
			}),
		[navigate],
	);

	if (offer === "closed") return null;
	return (
		<NotificationOffer
			denied={offer === "denied"}
			onAnswered={(access) =>
				setOffer(access === "denied" ? "denied" : "closed")
			}
			onClose={() => setOffer("closed")}
		/>
	);
}

function NotificationOffer({
	denied,
	onAnswered,
	onClose,
}: {
	denied: boolean;
	onAnswered: (access: NotificationAccess) => void;
	onClose: () => void;
}) {
	return (
		<section
			aria-labelledby="notification-offer-title"
			className="fixed right-4 bottom-4 z-50 grid w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-lg border bg-popover p-4 text-popover-foreground text-sm shadow-lg"
		>
			{denied ? (
				<>
					<h2 id="notification-offer-title" className="font-medium">
						Notifications are blocked
					</h2>
					<p className="text-muted-foreground">
						You can allow them later in your browser's site settings. The tab
						title still shows when replies finish.
					</p>
					<Button size="sm" className="justify-self-end" onClick={onClose}>
						OK
					</Button>
				</>
			) : (
				<>
					<h2 id="notification-offer-title" className="font-medium">
						Get notified when a reply is ready?
					</h2>
					<p className="text-muted-foreground">
						While this tab is in the background, we can tell you when a reply
						finishes or fails. A notification names the chat, never what's in
						it.
					</p>
					<div className="flex justify-end gap-2">
						<Button size="sm" variant="ghost" onClick={onClose}>
							Not now
						</Button>
						<Button
							size="sm"
							onClick={async () =>
								onAnswered(await requestNotificationAccess())
							}
						>
							Turn on notifications
						</Button>
					</div>
				</>
			)}
		</section>
	);
}
