import type { EncryptedSecret } from "./crypto";
import type { ProviderId } from "./providers";

// Where remembered keys live: their own IndexedDB database, apart from the chat store (1.3), so
// clearing keys never touches chats. Only ciphertext and display metadata are stored.

export type KeySource = "manual" | "openrouter-oauth";

export interface StoredKey {
	providerId: ProviderId;
	secret: EncryptedSecret;
	/** Shown in settings in place of the key. */
	last4: string;
	source: KeySource;
	savedAt: number;
}

/** The storage the vault needs. IndexedDB in the browser; an in-memory fake in unit tests. */
export interface KeyStore {
	getDeviceKey(): Promise<CryptoKey | undefined>;
	/** Stores `candidate` unless a device key exists already (another tab may have just made one). */
	getOrAddDeviceKey(candidate: CryptoKey): Promise<CryptoKey>;
	get(providerId: ProviderId): Promise<StoredKey | undefined>;
	list(): Promise<StoredKey[]>;
	put(record: StoredKey): Promise<void>;
	delete(providerId: ProviderId): Promise<void>;
}

const DB_NAME = "highelo-keys";
const DB_VERSION = 1;
const KEYS = "keys";
const DEVICE = "device";
const DEVICE_KEY_ID = "aes-gcm";

export function createIndexedDbKeyStore(): KeyStore {
	let db: Promise<IDBDatabase> | undefined;
	const open = () => {
		db ??= openDatabase();
		return db;
	};

	const run = async <T>(
		storeName: string,
		mode: IDBTransactionMode,
		action: (store: IDBObjectStore) => IDBRequest,
	): Promise<T> => {
		const database = await open();
		return new Promise<T>((resolve, reject) => {
			const transaction = database.transaction(storeName, mode);
			const request = action(transaction.objectStore(storeName));
			transaction.oncomplete = () => resolve(request.result as T);
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	};

	return {
		getDeviceKey: () =>
			run<CryptoKey | undefined>(DEVICE, "readonly", (store) =>
				store.get(DEVICE_KEY_ID),
			),
		getOrAddDeviceKey: async (candidate) => {
			// One readwrite transaction, so two tabs can't both store a key and orphan the other's records.
			const database = await open();
			return new Promise<CryptoKey>((resolve, reject) => {
				const transaction = database.transaction(DEVICE, "readwrite");
				const store = transaction.objectStore(DEVICE);
				let result = candidate;
				const existing = store.get(DEVICE_KEY_ID);
				existing.onsuccess = () => {
					if (existing.result) result = existing.result as CryptoKey;
					else store.put(candidate, DEVICE_KEY_ID);
				};
				transaction.oncomplete = () => resolve(result);
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
		},
		get: (providerId) =>
			run<StoredKey | undefined>(KEYS, "readonly", (store) =>
				store.get(providerId),
			),
		list: () => run<StoredKey[]>(KEYS, "readonly", (store) => store.getAll()),
		put: (record) => run(KEYS, "readwrite", (store) => store.put(record)),
		delete: (providerId) =>
			run(KEYS, "readwrite", (store) => store.delete(providerId)),
	};
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const database = request.result;
			database.createObjectStore(KEYS, { keyPath: "providerId" });
			database.createObjectStore(DEVICE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
		request.onblocked = () =>
			reject(new Error("The key database is blocked by another tab"));
	});
}
