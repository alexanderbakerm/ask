import { describe, expect, it } from "vitest";
import { wrapWithRowLimit } from "./sql-limit";

describe("wrapWithRowLimit", () => {
	it("wraps the query in a bounded subquery", () => {
		const out = wrapWithRowLimit("SELECT * FROM orders", 100);
		expect(out).toContain("SELECT * FROM (");
		expect(out).toContain("SELECT * FROM orders");
		expect(out).toContain(") AS _askbi_q");
		expect(out.trimEnd().endsWith("LIMIT 100")).toBe(true);
	});

	it("strips a single trailing semicolon", () => {
		const out = wrapWithRowLimit("SELECT 1;", 10);
		expect(out).not.toContain(";");
		expect(out).toContain("SELECT 1");
	});

	it("floors and floors-to-at-least-1 the limit", () => {
		expect(
			wrapWithRowLimit("SELECT 1", 10.9).trimEnd().endsWith("LIMIT 10"),
		).toBe(true);
		expect(wrapWithRowLimit("SELECT 1", 0).trimEnd().endsWith("LIMIT 1")).toBe(
			true,
		);
		expect(wrapWithRowLimit("SELECT 1", -5).trimEnd().endsWith("LIMIT 1")).toBe(
			true,
		);
	});

	it("keeps a pre-existing inner LIMIT (clamped by the outer, not doubled)", () => {
		const out = wrapWithRowLimit("SELECT * FROM orders LIMIT 5", 1001);
		// Both limits present; the inner runs first, the outer caps the result.
		expect(out).toContain("LIMIT 5");
		expect(out.trimEnd().endsWith("LIMIT 1001")).toBe(true);
	});

	it("puts a newline before the closing paren (guards trailing line comments)", () => {
		const out = wrapWithRowLimit("SELECT 1 -- trailing comment", 10);
		expect(out).toContain("-- trailing comment\n)");
	});
});
