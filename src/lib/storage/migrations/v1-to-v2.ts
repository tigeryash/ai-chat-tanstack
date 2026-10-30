// Format 2 records who owns each chat (roadmap 1.9): `ownerId` is the Better Auth user ID of the
// account that made it, or null for a chat made signed out. Chats from before then weren't tied to
// any account, so they all become no-account chats; the sign-in prompt offers to add them to one.
// Messages are the same as in format 1.

export function v1ToV2(raw: unknown): unknown {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error("A format 1 chat isn't an object.");
	}
	return { ...raw, formatVersion: 2, ownerId: null };
}
