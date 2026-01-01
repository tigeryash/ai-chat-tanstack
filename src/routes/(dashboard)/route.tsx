import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

const DashboardLayout = () => {
	return (
		<div className="flex h-screen">
			<aside className="w-64 border-r bg-gray-50 p-4">
				<h2 className="font-bold mb-4">Chat History</h2>
				{/* Fetch and map chats from Convex here */}
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
