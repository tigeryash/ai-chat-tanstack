import { createFileRoute } from "@tanstack/react-router";
import Dexie from "dexie";
import { useEffect, useRef, useState } from "react";
import type { Chat, ChatStore } from "@/lib/storage/chat-store";
import { type ChatDatabase, openChatDatabase } from "@/lib/storage/db";
import { createDexieChatStore } from "@/lib/storage/dexie-chat-store";
import { ChatStoreError } from "@/lib/storage/errors";
import { exportChats, importChats } from "@/lib/storage/export";
import v0Chat from "@/lib/storage/fixtures/chat-v0.json";
import { requestPersistentStorage } from "@/lib/storage/persistence";

export const Route = createFileRoute("/e2e/storage")({
	component: StorageHarness,
});

// Its own database, so wiping here never touches the app's chats in `bun run dev`.
const DB_NAME = "highelo-chats-e2e";

interface Connection {
	db: ChatDatabase;
	store: ChatStore;
}

function connect(): Connection {
	const db = openChatDatabase(DB_NAME);
	return { db, store: createDexieChatStore({ db }) };
}

async function seedV0Chat(db: ChatDatabase) {
	const { messages, ...row } = v0Chat;
	await db.chats.put({
		...row,
		messageCount: messages.length,
		formatVersion: 0,
	});
	await db.messages.bulkPut(
		messages.map((message, position) => ({
			chatId: row.id,
			position,
			message,
		})),
	);
}

async function loadAll(store: ChatStore): Promise<Chat[]> {
	const chats = await Promise.all(
		(await store.listChats()).map((chat) => store.getChat(chat.id)),
	);
	return chats.filter((chat) => chat !== undefined);
}

function textOf(chat: Chat): string[] {
	return chat.messages.map((message) =>
		message.parts
			.flatMap((part) => (part.type === "text" ? [part.text] : []))
			.join(" "),
	);
}

// The chat store in a real browser: save, migrate, export, wipe, and import, and check that chats
// survive a reload. `data-ready` tells tests when the page has read the database.
function StorageHarness() {
	// A ref, because Wipe swaps the connection in the middle of an action.
	const connection = useRef<Connection>(undefined);
	const [chats, setChats] = useState<Chat[]>();
	const [exported, setExported] = useState("");
	const [status, setStatus] = useState("");

	useEffect(() => {
		const opened = connect();
		connection.current = opened;
		void loadAll(opened.store).then(setChats);
		return () => connection.current?.db.close();
	}, []);

	async function run(
		action: (connection: Connection) => Promise<string | undefined>,
	) {
		if (!connection.current) return;
		try {
			setStatus((await action(connection.current)) ?? "");
		} catch (error) {
			setStatus(
				error instanceof ChatStoreError ? `Error: ${error.code}` : "Error",
			);
		}
		setChats(await loadAll(connection.current.store));
	}

	const actions: {
		label: string;
		act: (connection: Connection) => Promise<string | undefined>;
	}[] = [
		{
			label: "Save chat",
			act: async ({ store }) => {
				const { created } = await store.saveMessages("sample", [
					{
						id: "u1",
						role: "user",
						parts: [{ type: "text", text: "Hello storage" }],
					},
					{
						id: "a1",
						role: "assistant",
						parts: [{ type: "text", text: "Saved locally" }],
					},
				]);
				if (created) return `Persistence: ${await requestPersistentStorage()}`;
			},
		},
		{
			label: "Rename chat",
			act: async ({ store }) => {
				await store.renameChat("sample", "Renamed sample");
				return undefined;
			},
		},
		{
			label: "Seed v0 chat",
			act: async ({ db }) => {
				await seedV0Chat(db);
				return undefined;
			},
		},
		{
			label: "Export",
			act: async ({ store }) => {
				const result = await exportChats(store);
				setExported(result.json);
				return `Exported ${result.chatCount}`;
			},
		},
		{
			label: "Wipe",
			act: async ({ db }) => {
				db.close();
				await Dexie.delete(DB_NAME);
				connection.current = connect();
				return "Wiped";
			},
		},
		{
			label: "Import",
			act: async ({ store }) => {
				const { imported } = await importChats(store, exported);
				return `Imported ${imported}`;
			},
		},
	];

	return (
		<main data-ready={chats !== undefined} className="flex flex-col gap-4 p-6">
			<div className="flex flex-wrap gap-2">
				{actions.map(({ label, act }) => (
					<button
						key={label}
						type="button"
						className="rounded border px-3 py-1"
						onClick={() => void run(act)}
					>
						{label}
					</button>
				))}
			</div>
			<p role="status">{status}</p>
			<ul aria-label="Chats">
				{chats?.map((chat) => (
					<li key={chat.id} data-chat-id={chat.id}>
						<h2>{chat.title || "Untitled"}</h2>
						<ol>
							{textOf(chat).map((text, index) => (
								<li key={chat.messages[index].id}>{text}</li>
							))}
						</ol>
					</li>
				))}
			</ul>
		</main>
	);
}
