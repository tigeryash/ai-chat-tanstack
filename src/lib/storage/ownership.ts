// Which stored chats the app shows (roadmap 1.9). Every chat records its owner: the Better Auth user ID
// of the account that made it, or null for a chat made signed out. Signed out, you see only no-account
// chats; signed in, your account's chats plus the no-account ones; never another account's.
//
// This only decides what the app shows. Every chat stays readable in this browser's IndexedDB until
// it's deleted, so it isn't a security boundary between people sharing a browser profile.

/** Who is using the app: their Better Auth user ID, or null when signed out. */
export type Viewer = string | null;

interface Owned {
	ownerId: string | null;
}

export function isVisibleTo(chat: Owned, viewer: Viewer): boolean {
	return chat.ownerId === null || chat.ownerId === viewer;
}

export function visibleChats<T extends Owned>(
	chats: readonly T[],
	viewer: Viewer,
): T[] {
	return chats.filter((chat) => isVisibleTo(chat, viewer));
}

/** Chats made signed out, which any account can add to itself. */
export function noAccountChats<T extends Owned>(chats: readonly T[]): T[] {
	return chats.filter((chat) => chat.ownerId === null);
}

export function chatsOwnedBy<T extends Owned>(
	chats: readonly T[],
	userId: string,
): T[] {
	return chats.filter((chat) => chat.ownerId === userId);
}
