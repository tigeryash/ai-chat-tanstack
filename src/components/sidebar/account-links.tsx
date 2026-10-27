import { Link, useRouter } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { KeyRoundIcon, LogInIcon, LogOutIcon } from "lucide-react";
import { useEffect } from "react";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { logError } from "@/lib/log";
import { api } from "../../../convex/_generated/api";

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
	const router = useRouter();
	const { isAuthenticated, isLoading } = useConvexAuth();
	useUserRecord(isAuthenticated);

	const handleSignOut = async () => {
		const { error } = await authClient.signOut();
		if (error) {
			logError("Sign-out failed:", error.code ?? error.status);
			return;
		}
		// Re-runs the root `beforeLoad`, so the route context sees the session is gone.
		await router.invalidate();
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton render={<Link to="/settings" />}>
					<KeyRoundIcon />
					API keys
				</SidebarMenuButton>
			</SidebarMenuItem>
			{!isLoading && (
				<SidebarMenuItem>
					{isAuthenticated ? (
						<SidebarMenuButton onClick={handleSignOut}>
							<LogOutIcon />
							Sign out
						</SidebarMenuButton>
					) : (
						<SidebarMenuButton render={<Link to="/login" />}>
							<LogInIcon />
							Sign in to sync and share
						</SidebarMenuButton>
					)}
				</SidebarMenuItem>
			)}
		</SidebarMenu>
	);
}
