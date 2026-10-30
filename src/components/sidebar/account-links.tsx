import { Link } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { KeyRoundIcon, LogInIcon } from "lucide-react";
import { useEffect } from "react";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useViewer } from "@/lib/account";
import { logError } from "@/lib/log";
import { api } from "../../../convex/_generated/api";
import { SignOutItem } from "./sign-out-item";

// Chatting needs no account (decision 4): keys and chats stay in this browser. Signing in is only for
// the cloud features (sync and sharing, roadmap Phase 6).

/** Creates the signed-in person's user record. Signed out, there's nothing to create. */
function useUserRecord(isAuthenticated: boolean) {
	const getOrCreateUser = useMutation(api.users.getOrCreate);
	useEffect(() => {
		if (!isAuthenticated) return;
		getOrCreateUser().catch((error) =>
			logError("Failed to create the user record:", error),
		);
	}, [isAuthenticated, getOrCreateUser]);
}

export function AccountLinks() {
	const { isAuthenticated } = useConvexAuth();
	useUserRecord(isAuthenticated);
	// Signed in or out by Better Auth's session, the same answer that decides which chats show.
	const viewer = useViewer();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton render={<Link to="/settings" />}>
					<KeyRoundIcon />
					API keys
				</SidebarMenuButton>
			</SidebarMenuItem>
			{viewer === undefined ? null : viewer ? (
				<SignOutItem userId={viewer} />
			) : (
				<SidebarMenuItem>
					<SidebarMenuButton render={<Link to="/login" />}>
						<LogInIcon />
						Sign in to sync and share
					</SidebarMenuButton>
				</SidebarMenuItem>
			)}
		</SidebarMenu>
	);
}
