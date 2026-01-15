import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { api } from "../../../convex/_generated/api";

const DashboardLayout = () => {
	const router = useRouter();
	const getOrCreateUser = useMutation(api.users.getOrCreate);

	useEffect(() => {
		getOrCreateUser().catch(console.error);
	}, [getOrCreateUser]);

	const handleSignOut = async () => {
		await authClient.signOut();
		await router.navigate({ to: "/login" });
	};
	return (
		<div className="flex h-screen">
			<aside className="w-64 border-r bg-gray-50 p-4">
				<h2 className="font-bold mb-4">Chat History</h2>
				{/* Fetch and map chats from Convex here */}

				<button
					type="button"
					onClick={handleSignOut}
					className="mt-auto px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
				>
					Sign Out
				</button>
			</aside>
			<main className="flex-1 overflow-hidden">
				<Outlet />
			</main>
		</div>
	);
};

export const Route = createFileRoute("/(dashboard)")({
	beforeLoad: ({ context }) => {
		if (!context.userId) {
			throw redirect({ to: "/login" });
		}
	},
	component: DashboardLayout,
});
