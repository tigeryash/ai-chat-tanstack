// Format 3 can carry branches (roadmap 1.7): other versions of edited messages and the replies they
// had, in `branches` (branches.ts). Format 2 chats had none, so they get an empty set. Messages and
// every other field are the same as in format 2. The bump is what makes an older app refuse a file
// with branches ("too-new") rather than import it and quietly lose them.

export function v2ToV3(raw: unknown): unknown {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error("A format 2 chat isn't an object.");
	}
	return { ...raw, formatVersion: 3, branches: { forks: [], messages: [] } };
}
