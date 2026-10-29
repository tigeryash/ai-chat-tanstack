import { describe, expect, it } from "vitest";
import {
	chatsOwnedBy,
	isVisibleTo,
	noAccountChats,
	visibleChats,
} from "./ownership";

const chats = [
	{ id: "anyone", ownerId: null },
	{ id: "a", ownerId: "user-a" },
	{ id: "b", ownerId: "user-b" },
];
const ids = (list: readonly { id: string }[]) => list.map((chat) => chat.id);

describe("chat ownership", () => {
	it("shows only no-account chats when signed out", () => {
		expect(ids(visibleChats(chats, null))).toEqual(["anyone"]);
	});

	it("shows an account its own chats plus the no-account ones, never another account's", () => {
		expect(ids(visibleChats(chats, "user-a"))).toEqual(["anyone", "a"]);
		expect(ids(visibleChats(chats, "user-b"))).toEqual(["anyone", "b"]);
		expect(isVisibleTo({ ownerId: "user-b" }, "user-a")).toBe(false);
		expect(ids(visibleChats(chats, "user-c"))).toEqual(["anyone"]);
	});

	it("picks out the no-account chats and an account's chats", () => {
		expect(ids(noAccountChats(chats))).toEqual(["anyone"]);
		expect(ids(chatsOwnedBy(chats, "user-a"))).toEqual(["a"]);
	});
});
