import { logWarn } from "@/lib/log";
import { forgetSecret, registerSecret } from "@/lib/redact";
import { createDeviceKey, decryptSecret, encryptSecret } from "./crypto";
import { notifyKeysChanged } from "./key-events";
import {
	createIndexedDbKeyStore,
	type KeySource,
	type KeyStore,
} from "./key-store";
import type { ProviderId } from "./providers";

// The key vault (roadmap 1.1, decision 2). One key per provider, kept either for this tab's session
// (memory only, gone on reload) or on this device (IndexedDB, encrypted). Nothing here sends a key
// anywhere: the chat transport (1.2) and the key test read it with `getProviderKey`.

export type KeyMode = "session" | "remember";

export interface KeySummary {
	providerId: ProviderId;
	last4: string;
	mode: KeyMode;
	source: KeySource;
	savedAt: number;
}

interface SessionKey {
	key: string;
	source: KeySource;
	savedAt: number;
}

/** Printable ASCII without spaces, as every provider's keys are. Rejects pasted newlines or headers. */
const KEY_FORMAT = /^[\x21-\x7e]{8,512}$/;

export class InvalidKeyError extends Error {
	override name = "InvalidKeyError";
}

/** Trims a pasted key and checks its shape. Throws `InvalidKeyError` without echoing the input. */
export function normalizeKey(input: string): string {
	const key = input.trim();
	if (!KEY_FORMAT.test(key)) {
		throw new InvalidKeyError(
			"That doesn't look like an API key. Paste the whole key, with no spaces.",
		);
	}
	return key;
}

export function createKeyVault(getStore: () => KeyStore) {
	const sessionKeys = new Map<ProviderId, SessionKey>();
	let deviceKey: Promise<CryptoKey> | undefined;

	const ensureDeviceKey = () => {
		deviceKey ??= getStore()
			.getDeviceKey()
			.then(
				async (existing) =>
					existing ?? getStore().getOrAddDeviceKey(await createDeviceKey()),
			);
		// A failure isn't cached, so the next save tries again.
		deviceKey.catch(() => {
			deviceKey = undefined;
		});
		return deviceKey;
	};

	const readRemembered = async (
		providerId: ProviderId,
	): Promise<string | null> => {
		const store = getStore();
		const record = await store.get(providerId);
		if (!record) return null;
		const key = await store.getDeviceKey();
		if (!key) return null;
		try {
			return await decryptSecret(key, providerId, record.secret);
		} catch (error) {
			// The device key was replaced or the record damaged. The key is unrecoverable; say so once.
			logWarn("A remembered API key couldn't be decrypted:", {
				providerId,
				error,
			});
			return null;
		}
	};

	return {
		async save(
			providerId: ProviderId,
			input: string,
			mode: KeyMode,
			source: KeySource = "manual",
		): Promise<KeySummary> {
			const key = normalizeKey(input);
			const savedAt = Date.now();
			registerSecret(key);
			await this.delete(providerId);
			if (mode === "session") {
				sessionKeys.set(providerId, { key, source, savedAt });
			} else {
				const secret = await encryptSecret(
					await ensureDeviceKey(),
					providerId,
					key,
				);
				await getStore().put({
					providerId,
					secret,
					last4: key.slice(-4),
					source,
					savedAt,
				});
			}
			return { providerId, last4: key.slice(-4), mode, source, savedAt };
		},

		/** The key for `providerId`, or null. The only way to read a key back. */
		async get(providerId: ProviderId): Promise<string | null> {
			const session = sessionKeys.get(providerId);
			if (session) return session.key;
			const remembered = await readRemembered(providerId);
			if (remembered) registerSecret(remembered);
			return remembered;
		},

		async delete(providerId: ProviderId): Promise<void> {
			const session = sessionKeys.get(providerId);
			if (session) forgetSecret(session.key);
			sessionKeys.delete(providerId);
			await getStore().delete(providerId);
		},

		/** What settings shows: which providers have a key, and its last 4 characters. Never the key. */
		async list(): Promise<KeySummary[]> {
			const remembered = await getStore().list();
			const summaries: KeySummary[] = remembered
				.filter((record) => !sessionKeys.has(record.providerId))
				.map(({ providerId, last4, source, savedAt }) => ({
					providerId,
					last4,
					mode: "remember",
					source,
					savedAt,
				}));
			for (const [providerId, { key, source, savedAt }] of sessionKeys) {
				summaries.push({
					providerId,
					last4: key.slice(-4),
					mode: "session",
					source,
					savedAt,
				});
			}
			return summaries;
		},
	};
}

export type KeyVault = ReturnType<typeof createKeyVault>;

let indexedDbStore: KeyStore | undefined;
const vault = createKeyVault(() => {
	indexedDbStore ??= createIndexedDbKeyStore();
	return indexedDbStore;
});

export async function saveProviderKey(
	...args: Parameters<KeyVault["save"]>
): Promise<KeySummary> {
	try {
		return await vault.save(...args);
	} finally {
		// Also after a failure: save deletes the old key first.
		notifyKeysChanged();
	}
}
export const getProviderKey = vault.get.bind(vault);
export async function deleteProviderKey(providerId: ProviderId): Promise<void> {
	try {
		await vault.delete(providerId);
	} finally {
		notifyKeysChanged();
	}
}
export const listProviderKeys = vault.list.bind(vault);
