import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/chat/input";

export const Route = createFileRoute("/(dashboard)/new")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex justify-center items-center h-full flex-col space-y-8 ">
			<h1 className="text-4xl font-semibold">Start a New Chat</h1>
			<Input />
		</div>
	);
}
