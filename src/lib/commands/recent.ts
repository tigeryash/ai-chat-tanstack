import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import { type Command, isRememberable } from "./command";

// Recently run palette commands (roadmap R2 S5), kept in this browser's localStorage. Only fixed
// command ids ("new-chat", "setting.theme"), never a chat's or layout's (`isRememberable`), so the
// list says nothing about what's in your chats (docs/data-inventory.md).

export const RECENT_COMMANDS_KEY = "highelo-recent-commands";
export const MAX_RECENT_COMMANDS = 10;

const commandId = z
	.string()
	.max(64)
	.regex(/^[a-z0-9][a-z0-9._-]*$/);

const recentCommands = createLocalStore<string[]>(
	RECENT_COMMANDS_KEY,
	z.array(commandId).max(MAX_RECENT_COMMANDS),
	[],
);

/** Most recent first. */
export function useRecentCommands(): string[] {
	return recentCommands.use();
}

/** `ids` with `id` moved to the front, at most `MAX_RECENT_COMMANDS` long. */
export function withRecent(ids: readonly string[], id: string): string[] {
	return [id, ...ids.filter((other) => other !== id)].slice(
		0,
		MAX_RECENT_COMMANDS,
	);
}

export function rememberCommand(command: Command): void {
	if (!isRememberable(command) || !commandId.safeParse(command.id).success) {
		return;
	}
	recentCommands.write(withRecent(recentCommands.read(), command.id));
}
