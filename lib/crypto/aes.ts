/**
 * AES-256-GCM authenticated encryption primitives.
 *
 * Pure helpers with no dependency on the app env, so they are trivially
 * unit-testable. The env-bound wrappers live in `./secrets`.
 *
 * Ciphertext envelope format (string, colon-delimited, all base64):
 *
 *   v1:<iv>:<authTag>:<ciphertext>
 *
 * - `v1`        version tag, lets us rotate the scheme later
 * - `iv`        12-byte random nonce (96-bit, the GCM recommendation)
 * - `authTag`   16-byte GCM authentication tag (integrity + authenticity)
 * - `ciphertext` the encrypted payload
 */

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // 256-bit key
const IV_BYTES = 12; // 96-bit nonce, recommended for GCM
const VERSION = "v1";

/**
 * Parse a raw key string into a 32-byte Buffer.
 *
 * Accepts either:
 * - 64 hex characters (`openssl rand -hex 32`), or
 * - base64 that decodes to exactly 32 bytes (`openssl rand -base64 32`).
 *
 * Throws a descriptive error if the key is malformed, so misconfiguration
 * fails loudly at boot rather than silently weakening encryption.
 */
export function parseEncryptionKey(raw: string): Buffer {
	if (!raw) {
		throw new Error("Encryption key is empty");
	}

	// 64-char hex → 32 bytes
	if (/^[0-9a-fA-F]{64}$/.test(raw)) {
		return Buffer.from(raw, "hex");
	}

	// Otherwise try base64 and require exactly 32 decoded bytes
	const decoded = Buffer.from(raw, "base64");
	if (decoded.length === KEY_BYTES) {
		return decoded;
	}

	throw new Error(
		"Encryption key must be 32 bytes: provide 64 hex chars (`openssl rand -hex 32`) " +
			"or base64 of 32 bytes (`openssl rand -base64 32`)",
	);
}

function assertKey(key: Buffer): void {
	if (key.length !== KEY_BYTES) {
		throw new Error(`Encryption key must be ${KEY_BYTES} bytes`);
	}
}

/** Encrypt UTF-8 plaintext, returning the versioned envelope string. */
export function encryptWithKey(plaintext: string, key: Buffer): string {
	assertKey(key);
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return [
		VERSION,
		iv.toString("base64"),
		authTag.toString("base64"),
		ciphertext.toString("base64"),
	].join(":");
}

/**
 * Decrypt a versioned envelope string produced by {@link encryptWithKey}.
 * Throws if the version is unknown, the envelope is malformed, or the
 * authentication tag does not verify (tampering / wrong key).
 */
export function decryptWithKey(envelope: string, key: Buffer): string {
	assertKey(key);

	const parts = envelope.split(":");
	const [version, ivB64, tagB64, ctB64] = parts;
	// Note: ctB64 may legitimately be "" (empty plaintext → empty ciphertext),
	// so check for `undefined` rather than falsiness.
	if (
		parts.length !== 4 ||
		version === undefined ||
		ivB64 === undefined ||
		tagB64 === undefined ||
		ctB64 === undefined
	) {
		throw new Error("Malformed ciphertext envelope");
	}
	if (version !== VERSION) {
		throw new Error(`Unsupported ciphertext version: ${version}`);
	}

	const iv = Buffer.from(ivB64, "base64");
	const authTag = Buffer.from(tagB64, "base64");
	const ciphertext = Buffer.from(ctB64, "base64");

	if (iv.length !== IV_BYTES) {
		throw new Error("Malformed ciphertext: invalid IV length");
	}

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	// `final()` throws if the auth tag does not verify.
	const plaintext = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);
	return plaintext.toString("utf8");
}

/** Constant-time string comparison (e.g. for token checks). */
export function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a, "utf8");
	const bufB = Buffer.from(b, "utf8");
	if (bufA.length !== bufB.length) {
		return false;
	}
	return timingSafeEqual(bufA, bufB);
}
