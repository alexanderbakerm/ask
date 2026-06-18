import { describe, expect, it } from "vitest";
import { sanitizeDbError } from "./errors";

describe("sanitizeDbError", () => {
	it("maps an auth failure to a generic message (no user leak)", () => {
		const result = sanitizeDbError({
			code: "28P01",
			message: 'password authentication failed for user "admin"',
		});
		expect(result).toBe("Authentication failed");
		expect(result).not.toContain("admin");
	});

	it("maps connection-refused without leaking the host:port", () => {
		const result = sanitizeDbError({
			code: "ECONNREFUSED",
			message: "connect ECONNREFUSED 10.1.2.3:5432",
		});
		expect(result).toBe("Could not reach the database host");
		expect(result).not.toContain("10.1.2.3");
	});

	it("keeps read-only and timeout semantics (mapped messages)", () => {
		expect(sanitizeDbError({ code: "25006" })).toMatch(/read-only/i);
		expect(sanitizeDbError({ code: "57014" })).toMatch(/timeout/i);
	});

	it("redacts IPv4 addresses in unmapped messages", () => {
		const result = sanitizeDbError({
			message: "could not translate host 192.168.0.42 to address",
		});
		expect(result).not.toContain("192.168.0.42");
		expect(result).toContain("[redacted-host]");
	});

	it("redacts quoted user names in unmapped messages", () => {
		const result = sanitizeDbError({
			message: 'role "reporting_user" does not exist',
		});
		expect(result).not.toContain("reporting_user");
	});

	it("redacts key=value connection fragments", () => {
		const result = sanitizeDbError({
			message: "connection failed host=db.internal user=svc port=5432",
		});
		expect(result).not.toContain("db.internal");
		expect(result).not.toContain("svc");
	});

	it("preserves a benign query error (e.g. syntax)", () => {
		const result = sanitizeDbError({
			code: "42601",
			message: 'syntax error at or near "FROM"',
		});
		expect(result).toContain("syntax error");
	});

	it("handles non-error inputs", () => {
		expect(sanitizeDbError(undefined)).toBe("Database error");
		expect(sanitizeDbError("a string")).toBe("Database error");
		expect(sanitizeDbError({})).toBe("Database error");
	});

	it("caps very long messages", () => {
		const result = sanitizeDbError({ message: "x".repeat(2000) });
		expect(result.length).toBeLessThanOrEqual(500);
	});
});
