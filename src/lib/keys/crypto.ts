// Encryption for remembered keys (roadmap decision 2). The device key is a non-extractable AES-GCM
// CryptoKey stored in IndexedDB: script on our page can use it but never read its bytes, so a copied
// browser profile alone doesn't give up the API keys. It doesn't stop malicious script on the page,
// which can call decrypt like we do (docs/security.md, "API keys").

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

export interface EncryptedSecret {
	iv: Uint8Array<ArrayBuffer>;
	ciphertext: ArrayBuffer;
}

export function createDeviceKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, [
		"encrypt",
		"decrypt",
	]);
}

/**
 * Encrypts `plaintext`, bound to `context` (the provider id) as additional data, so a record moved
 * to another provider's slot fails to decrypt instead of sending one provider's key to another.
 */
export async function encryptSecret(
	deviceKey: CryptoKey,
	context: string,
	plaintext: string,
): Promise<EncryptedSecret> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv, additionalData: encode(context) },
		deviceKey,
		encode(plaintext),
	);
	return { iv, ciphertext };
}

export async function decryptSecret(
	deviceKey: CryptoKey,
	context: string,
	{ iv, ciphertext }: EncryptedSecret,
): Promise<string> {
	const plaintext = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv, additionalData: encode(context) },
		deviceKey,
		ciphertext,
	);
	return new TextDecoder().decode(plaintext);
}

function encode(text: string): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(text);
}
