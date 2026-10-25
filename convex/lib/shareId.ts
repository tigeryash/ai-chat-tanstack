// URL-safe alphabet of exactly 64 characters, so `byte & 63` maps every byte value evenly.
const SHARE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// 22 characters × 6 bits = 132 bits of randomness.
export const SHARE_ID_LENGTH = 22;

/** An unguessable share link ID from the platform CSPRNG (never `Math.random`). */
export function generateShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_LENGTH));
  return Array.from(bytes, (byte) => SHARE_ID_ALPHABET[byte & 63]).join("");
}
