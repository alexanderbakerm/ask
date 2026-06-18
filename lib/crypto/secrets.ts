import "server-only";

import { env } from "@/lib/env";
import { decryptWithKey, encryptWithKey, parseEncryptionKey } from "./aes";

/**
 * Env-bound secret encryption for data-source credentials at rest.
 *
 * The key is read once from `ENCRYPTION_KEY` and cached. Parsing throws if the
 * key is malformed, surfacing misconfiguration on first use rather than
 * producing weak/broken ciphertext. `ENCRYPTION_KEY` itself is validated as
 * required in `lib/env.ts`, so the app fails fast at boot when it is absent.
 *
 * These helpers are `server-only`: encrypted credentials must never be sent to
 * or decrypted in the browser.
 */

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
	if (!cachedKey) {
		cachedKey = parseEncryptionKey(env.ENCRYPTION_KEY);
	}
	return cachedKey;
}

/** Encrypt a plaintext secret into a storable envelope string. */
export function encryptSecret(plaintext: string): string {
	return encryptWithKey(plaintext, getKey());
}

/** Decrypt an envelope string produced by {@link encryptSecret}. */
export function decryptSecret(envelope: string): string {
	return decryptWithKey(envelope, getKey());
}

/** Encrypt a JSON-serializable value (e.g. a credentials object). */
export function encryptJson(value: unknown): string {
	return encryptSecret(JSON.stringify(value));
}

/** Decrypt and parse a JSON value previously stored with {@link encryptJson}. */
export function decryptJson<T>(envelope: string): T {
	return JSON.parse(decryptSecret(envelope)) as T;
}
