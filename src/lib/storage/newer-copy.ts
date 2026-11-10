// Which copies an import writes (roadmap 1.10): within one file the newest copy of each id wins; then
// only new ones, and ones newer than the copy already here. Shared by chats, prompts, workspaces and
// saved layouts, so they all follow the same rule.

interface Identified {
	id: string;
}

export interface Newer<T> {
	/** New ones, and ones newer than the copy here. */
	items: T[];
	/** Of `items`, how many replace a copy here. */
	updated: number;
	/** Distinct ids in the file that weren't newer than the copy here. */
	skipped: number;
}

export const NOTHING_NEWER: Newer<never> = {
	items: [],
	updated: 0,
	skipped: 0,
};

/**
 * `stamp` reads when a copy was last changed; `keep` adapts an incoming copy that replaces one here
 * (by default it's written as it is).
 */
export function newerCopies<T extends Identified, H extends Identified>(
	incoming: readonly T[],
	here: readonly H[],
	stamp: (item: T | H) => number,
	keep: (item: T, mine: H) => T = (item) => item,
): Newer<T> {
	const newest = new Map<string, T>();
	for (const item of incoming) {
		const seen = newest.get(item.id);
		if (!seen || stamp(item) > stamp(seen)) newest.set(item.id, item);
	}
	const local = new Map(here.map((item) => [item.id, item]));
	const items = [...newest.values()].flatMap((item) => {
		const mine = local.get(item.id);
		if (!mine) return [item];
		return stamp(item) > stamp(mine) ? [keep(item, mine)] : [];
	});
	return {
		items,
		updated: items.filter((item) => local.has(item.id)).length,
		skipped: newest.size - items.length,
	};
}

interface Owned extends Identified {
	updatedAt: number;
	ownerId: string | null;
}

/** `newerCopies` for owned records (roadmap 1.9): a copy that replaces one here keeps that copy's owner. */
export function newerThanHere<T extends Owned>(
	incoming: readonly T[],
	here: readonly Owned[],
): Newer<T> {
	return newerCopies(
		incoming,
		here,
		(item) => item.updatedAt,
		(item, mine) => ({ ...item, ownerId: mine.ownerId }),
	);
}
