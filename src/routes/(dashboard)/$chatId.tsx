import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(dashboard)/$chatId")({
	component: RouteComponent,
});

function RouteComponent() {
	const { messages } = useChat();

	return <div>{!messages.length && "No messages yet."}</div>;
}
