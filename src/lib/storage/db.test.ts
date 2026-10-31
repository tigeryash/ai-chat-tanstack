import Dexie, { type Version } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { openChatDatabase } from "./db";

// Guards db.ts's version convention (see its header): a bad rebase of two slices that both add a Dexie
// version should fail here, not in a browser.

type StoresSpec = Record<string, string | null>;

interface DeclaredVersion {
	version: number;
	stores: StoresSpec;
	hasUpgrade: boolean;
}

/** Records every `version()` block openChatDatabase declares, in source order. */
function declaredVersions(): DeclaredVersion[] {
	const declared: DeclaredVersion[] = [];
	const original = Dexie.prototype.version;
	Dexie.prototype.version = function (this: Dexie, version: number): Version {
		const result = original.call(this, version);
		const entry: DeclaredVersion = { version, stores: {}, hasUpgrade: false };
		declared.push(entry);
		const stores = result.stores.bind(result);
		const upgrade = result.upgrade.bind(result);
		result.stores = (spec: StoresSpec) => {
			entry.stores = { ...entry.stores, ...spec };
			return stores(spec);
		};
		result.upgrade = (fn: Parameters<Version["upgrade"]>[0]) => {
			entry.hasUpgrade = true;
			return upgrade(fn);
		};
		return result;
	};
	try {
		openChatDatabase("declared-versions", {
			indexedDB: new IDBFactory(),
			IDBKeyRange,
		}).close();
	} finally {
		Dexie.prototype.version = original;
	}
	return declared;
}

/** The schema as Dexie applies it after `version`'s block, with every earlier block merged in. */
function schemaAt(version: number): StoresSpec {
	const stores = declaredVersions()
		.filter((entry) => entry.version <= version)
		.map((entry) => entry.stores);
	return Object.assign({}, ...stores);
}

/** A database as a browser left it at `version`, with no upgrades run. */
function openAtVersion(name: string, indexedDB: IDBFactory, version: number) {
	const db = new Dexie(name, { indexedDB, IDBKeyRange });
	db.version(version).stores(schemaAt(version));
	return db;
}

// One test per version with an `upgrade()`: it opens a database at the previous version, writes rows as
// that version stored them, then opens it with openChatDatabase. Add one when you add an upgrade.
const UPGRADE_TESTS: Record<number, () => Promise<void>> = {
	2: async () => {
		const indexedDB = new IDBFactory();
		const old = openAtVersion("upgrade-2", indexedDB, 1);
		await old.table("chats").bulkPut([
			{
				id: "c1",
				title: "Old",
				createdAt: 1,
				updatedAt: 2,
				messageCount: 0,
				formatVersion: 1,
			},
			// Already format 2 (a newer tab wrote it): left as it is.
			{
				id: "c2",
				title: "New",
				createdAt: 1,
				updatedAt: 2,
				messageCount: 0,
				formatVersion: 2,
				ownerId: "u",
			},
		]);
		old.close();

		const db = openChatDatabase("upgrade-2", { indexedDB, IDBKeyRange });
		expect(await db.chats.get("c1")).toMatchObject({
			formatVersion: 2,
			ownerId: null,
		});
		expect(await db.chats.get("c2")).toMatchObject({
			formatVersion: 2,
			ownerId: "u",
		});
		db.close();
	},
};

describe("chat database versions", () => {
	it("declares versions in strictly increasing order", () => {
		const versions = declaredVersions().map((entry) => entry.version);
		expect(versions.length).toBeGreaterThan(0);
		for (let i = 1; i < versions.length; i++) {
			expect(
				versions[i],
				`version(${versions[i]}) after version(${versions[i - 1]})`,
			).toBeGreaterThan(versions[i - 1]);
		}
	});

	it("matches the pinned schema", async () => {
		// Update this when a slice adds a version, in the same commit, after rebasing on main.
		const db = openChatDatabase("pinned-schema", {
			indexedDB: new IDBFactory(),
			IDBKeyRange,
		});
		await db.open();
		const schema = Object.fromEntries(
			db.tables.map((table) => [
				table.name,
				[
					table.schema.primKey.src,
					...table.schema.indexes.map((index) => index.src).sort(),
				],
			]),
		);
		expect({ version: db.verno, schema }).toEqual({
			version: 4,
			schema: {
				chats: ["id", "updatedAt"],
				messages: ["[chatId+position]"],
				prefs: ["key"],
				workspaces: ["id", "updatedAt"],
			},
		});
		db.close();
	});

	it("keeps upgrades in versions that change nothing else", () => {
		for (const entry of declaredVersions().filter((e) => e.hasUpgrade)) {
			expect(schemaAt(entry.version), `version(${entry.version})`).toEqual(
				schemaAt(entry.version - 1),
			);
		}
	});

	it("has an upgrade test for every version with an upgrade()", () => {
		const withUpgrade = declaredVersions()
			.filter((entry) => entry.hasUpgrade)
			.map((entry) => entry.version);
		expect(Object.keys(UPGRADE_TESTS).map(Number)).toEqual(withUpgrade);
	});

	for (const [version, run] of Object.entries(UPGRADE_TESTS)) {
		it(
			`upgrades a version ${Number(version) - 1} database to version ${version}`,
			run,
		);
	}
});
