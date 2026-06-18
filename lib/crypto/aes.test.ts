import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	decryptWithKey,
	encryptWithKey,
	parseEncryptionKey,
	safeEqual,
} from "./aes";

const KEY = randomBytes(32);

describe("parseEncryptionKey", () => {
	it("accepts 64 hex characters", () => {
		const key = parseEncryptionKey("a".repeat(64));
		expect(key.length).toBe(32);
	});

	it("accepts base64 of 32 bytes", () => {
		const raw = randomBytes(32).toString("base64");
		expect(parseEncryptionKey(raw).length).toBe(32);
	});

	it("rejects an empty key", () => {
		expect(() => parseEncryptionKey("")).toThrow();
	});

	it("rejects a key that decodes to the wrong length", () => {
		expect(() => parseEncryptionKey("too-short")).toThrow(/32 bytes/);
	});
});

describe("encryptWithKey / decryptWithKey", () => {
	it("round-trips plaintext", () => {
		const secret = JSON.stringify({ password: "hunter2", host: "db.internal" });
		const envelope = encryptWithKey(secret, KEY);
		expect(decryptWithKey(envelope, KEY)).toBe(secret);
	});

	it("round-trips unicode and empty strings", () => {
		for (const value of ["", "héllo 🌎", "a".repeat(10_000)]) {
			expect(decryptWithKey(encryptWithKey(value, KEY), KEY)).toBe(value);
		}
	});

	it("produces a versioned 4-part envelope", () => {
		const envelope = encryptWithKey("x", KEY);
		const parts = envelope.split(":");
		expect(parts).toHaveLength(4);
		expect(parts[0]).toBe("v1");
	});

	it("uses a fresh IV each time (ciphertext is non-deterministic)", () => {
		expect(encryptWithKey("same", KEY)).not.toBe(encryptWithKey("same", KEY));
	});

	it("fails to decrypt with the wrong key", () => {
		const envelope = encryptWithKey("secret", KEY);
		expect(() => decryptWithKey(envelope, randomBytes(32))).toThrow();
	});

	it("fails to decrypt tampered ciphertext (auth tag check)", () => {
		const envelope = encryptWithKey("secret", KEY);
		const parts = envelope.split(":");
		// Flip a byte in the ciphertext segment.
		const ct = Buffer.from(parts[3] ?? "", "base64");
		ct[0] = (ct[0] ?? 0) ^ 0xff;
		parts[3] = ct.toString("base64");
		expect(() => decryptWithKey(parts.join(":"), KEY)).toThrow();
	});

	it("rejects a malformed envelope", () => {
		expect(() => decryptWithKey("not-a-valid-envelope", KEY)).toThrow();
	});

	it("rejects an unknown version", () => {
		const envelope = encryptWithKey("secret", KEY);
		const parts = envelope.split(":");
		parts[0] = "v2";
		expect(() => decryptWithKey(parts.join(":"), KEY)).toThrow(/version/);
	});
});

describe("safeEqual", () => {
	it("returns true for equal strings", () => {
		expect(safeEqual("token-abc", "token-abc")).toBe(true);
	});

	it("returns false for different strings", () => {
		expect(safeEqual("token-abc", "token-xyz")).toBe(false);
		expect(safeEqual("short", "longer-string")).toBe(false);
	});
});
