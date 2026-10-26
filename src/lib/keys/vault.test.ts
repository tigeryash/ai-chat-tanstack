import { describe, expect, it } from "vitest";
import { REDACTED, redactString } from "@/lib/redact";
import type { KeyStore, StoredKey } from "./key-store";
import type { ProviderId } from "./providers";
import { createKeyVault, InvalidKeyError, normalizeKey } from "./vault";

// IndexedDB's stand-in: holds records the way structured clone would, by value. The real store is
// covered by e2e/keys.spec.ts (keys survive a reload).
function memoryStore() {
	const records = new Map<ProviderId, StoredKey>();
	let deviceKey: CryptoKey | undefined;
	const store: KeyStore = {
		getDeviceKey: async () => deviceKey,
		getOrAddDeviceKey: async (candidate) => {
			deviceKey ??= candidate;
			return deviceKey;
		},
		get: async (providerId) => records.get(providerId),
		list: async () => [...records.values()],
		put: async (record) => {
			records.set(record.providerId, structuredClone(record));
		},
		delete: async (providerId) => {
			records.delete(providerId);
		},
	};
	return { store, records, getDeviceKey: () => deviceKey };
}

const OPENAI_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz1234";
// Built at runtime so GitHub's secret scanning doesn't take it for a real Mistral key.
const MISTRAL_KEY = ["Fake", "Mistral", "Key", "0123456789", "QrStUv"].join("");

describe("key vault", () => {
	it("keeps a session key in memory only", async () => {
		const { store, records } = memoryStore();
		const vault = createKeyVault(() => store);

		await vault.save("openai", OPENAI_KEY, "session");

		expect(await vault.get("openai")).toBe(OPENAI_KEY);
		expect(records.size).toBe(0);
		// A reload is a new vault over the same storage: the key is gone.
		expect(await createKeyVault(() => store).get("openai")).toBeNull();
	});

	it("stores a remembered key encrypted and reads it after a reload", async () => {
		const { store, records, getDeviceKey } = memoryStore();
		await createKeyVault(() => store).save("openai", OPENAI_KEY, "remember");

		const record = records.get("openai");
		expect(record?.last4).toBe("1234");
		const storedBytes = new TextDecoder("latin1").decode(
			record?.secret.ciphertext,
		);
		expect(storedBytes).not.toContain(OPENAI_KEY);
		expect(JSON.stringify(record)).not.toContain(OPENAI_KEY);
		expect(getDeviceKey()?.extractable).toBe(false);

		expect(await createKeyVault(() => store).get("openai")).toBe(OPENAI_KEY);
	});

	it("won't decrypt a record moved to another provider", async () => {
		const { store, records } = memoryStore();
		const vault = createKeyVault(() => store);
		await vault.save("openai", OPENAI_KEY, "remember");
		const record = records.get("openai");
		if (!record) throw new Error("not stored");
		records.set("groq", { ...record, providerId: "groq" });

		expect(await vault.get("groq")).toBeNull();
	});

	it("replaces a provider's key when saved again in the other mode", async () => {
		const { store, records } = memoryStore();
		const vault = createKeyVault(() => store);
		await vault.save("openai", OPENAI_KEY, "remember");
		await vault.save(
			"openai",
			"sk-proj-zyxwvutsrqponmlkjihgfedcba9876",
			"session",
		);

		expect(records.has("openai")).toBe(false);
		expect(await vault.list()).toEqual([
			expect.objectContaining({
				providerId: "openai",
				last4: "9876",
				mode: "session",
			}),
		]);
	});

	it("deletes from both places", async () => {
		const { store } = memoryStore();
		const vault = createKeyVault(() => store);
		await vault.save("openai", OPENAI_KEY, "remember");
		await vault.save("mistral", MISTRAL_KEY, "session");

		await vault.delete("openai");
		await vault.delete("mistral");

		expect(await vault.get("openai")).toBeNull();
		expect(await vault.get("mistral")).toBeNull();
		expect(await vault.list()).toEqual([]);
	});

	it("lists last 4 characters and never the key", async () => {
		const { store } = memoryStore();
		const vault = createKeyVault(() => store);
		await vault.save("openai", OPENAI_KEY, "remember", "manual");
		await vault.save("mistral", MISTRAL_KEY, "session");

		const listed = await vault.list();
		expect(JSON.stringify(listed)).not.toContain(OPENAI_KEY);
		expect(JSON.stringify(listed)).not.toContain(MISTRAL_KEY);
		expect(
			listed.map(({ providerId, last4, mode }) => [providerId, last4, mode]),
		).toEqual([
			["openai", "1234", "remember"],
			["mistral", "StUv", "session"],
		]);
	});

	it("makes one device key for concurrent first saves", async () => {
		const { store } = memoryStore();
		const vault = createKeyVault(() => store);
		await Promise.all([
			vault.save("openai", OPENAI_KEY, "remember"),
			vault.save("mistral", MISTRAL_KEY, "remember"),
		]);
		const reloaded = createKeyVault(() => store);
		expect(await reloaded.get("openai")).toBe(OPENAI_KEY);
		expect(await reloaded.get("mistral")).toBe(MISTRAL_KEY);
	});

	it("registers saved keys with the log scrubber, prefix or not", async () => {
		const { store } = memoryStore();
		await createKeyVault(() => store).save("mistral", MISTRAL_KEY, "session");

		expect(redactString(`401 for ${MISTRAL_KEY}`)).toBe(`401 for ${REDACTED}`);
	});
});

describe("normalizeKey", () => {
	it("trims a pasted key", () => {
		expect(normalizeKey(`  ${OPENAI_KEY}\n`)).toBe(OPENAI_KEY);
	});

	it.each([
		["empty", ""],
		["too short", "sk-1"],
		["inner space", "sk-proj abc defghijk"],
		["header injection", "sk-abcdefgh\r\nX-Evil: 1"],
		["non-ASCII", "sk-abcdefgh…"],
	])("rejects %s input without echoing it", (_, input) => {
		expect(() => normalizeKey(input)).toThrow(InvalidKeyError);
		try {
			normalizeKey(input);
		} catch (error) {
			if (input) expect((error as Error).message).not.toContain(input);
		}
	});
});
