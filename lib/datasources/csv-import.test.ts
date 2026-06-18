import { describe, expect, it } from "vitest";
import {
	buildCreateTableSql,
	coerceValue,
	type CsvColumn,
	inferColumnKind,
	normalizeIdentifier,
	parseCsv,
} from "./csv-import";

describe("normalizeIdentifier", () => {
	it("snake-cases and lowercases headers", () => {
		expect(normalizeIdentifier("Order Date", "c")).toBe("order_date");
		expect(normalizeIdentifier("Unit Price ($)", "c")).toBe("unit_price");
		expect(normalizeIdentifier("  Total  ", "c")).toBe("total");
	});
	it("prefixes leading digits and falls back when empty/unsafe", () => {
		expect(normalizeIdentifier("2024 revenue", "c")).toBe("c_2024_revenue");
		expect(normalizeIdentifier("***", "column_3")).toBe("column_3");
		expect(normalizeIdentifier("", "column_1")).toBe("column_1");
	});
	it("only ever emits a safe identifier", () => {
		for (const h of ['"; DROP TABLE x; --', "a b\tc", "café—naïve", "🚀"]) {
			expect(normalizeIdentifier(h, "fallback")).toMatch(/^[a-z_][a-z0-9_]*$/);
		}
	});
});

describe("inferColumnKind", () => {
	it("numbers (int, float, negative, scientific)", () => {
		expect(inferColumnKind(["1", "2", "-3", "4.5", "1e3"])).toBe("number");
	});
	it("ignores blanks, falls back to string on any outlier", () => {
		expect(inferColumnKind(["1", "", "2"])).toBe("number");
		expect(inferColumnKind(["1", "2", "n/a"])).toBe("string");
	});
	it("dates and datetimes", () => {
		expect(inferColumnKind(["2025-01-01", "2025-12-31"])).toBe("date");
		expect(inferColumnKind(["2025-01-01T08:00:00Z", "2025-02-01 09:30"])).toBe("datetime");
	});
	it("booleans (not 0/1, which are numbers)", () => {
		expect(inferColumnKind(["true", "false", "Yes", "no"])).toBe("boolean");
		expect(inferColumnKind(["0", "1", "1"])).toBe("number");
	});
	it("empty column → string", () => {
		expect(inferColumnKind(["", "  ", ""])).toBe("string");
	});
});

describe("coerceValue", () => {
	it("returns null for blanks and outliers (never a load-breaking value)", () => {
		expect(coerceValue("", "number")).toBeNull();
		expect(coerceValue("abc", "number")).toBeNull();
		expect(coerceValue("not-a-date", "date")).toBeNull();
	});
	it("coerces by kind", () => {
		expect(coerceValue("42.5", "number")).toBe(42.5);
		expect(coerceValue("YES", "boolean")).toBe(true);
		expect(coerceValue("no", "boolean")).toBe(false);
		expect(coerceValue("2025-06-16", "date")).toBe("2025-06-16");
		expect(coerceValue("  hi  ", "string")).toBe("hi");
	});
});

describe("parseCsv", () => {
	const csv = "Name,Amount,Order Date,Active\nAcme,1200.50,2025-01-05,true\nGlobex,,2025-02-10,false";
	it("derives typed, safe, unique columns from the header", () => {
		const { columns, rows } = parseCsv(csv);
		expect(columns.map((c) => c.name)).toEqual(["name", "amount", "order_date", "active"]);
		expect(columns.map((c) => c.kind)).toEqual(["string", "number", "date", "boolean"]);
		expect(columns.find((c) => c.name === "amount")?.pgType).toBe("numeric");
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual(["Acme", "1200.50", "2025-01-05", "true"]);
	});
	it("dedupes duplicate headers", () => {
		const { columns } = parseCsv("a,a,a\n1,2,3");
		expect(columns.map((c) => c.name)).toEqual(["a", "a_2", "a_3"]);
	});
	it("synthesizes names when hasHeader is false", () => {
		const { columns, rows } = parseCsv("1,2\n3,4", false);
		expect(columns.map((c) => c.name)).toEqual(["column_1", "column_2"]);
		expect(rows).toHaveLength(2);
	});
	it("pads ragged rows to the column count", () => {
		const { rows } = parseCsv("a,b,c\n1\n2,3,4,5");
		expect(rows[0]).toEqual(["1", "", ""]);
		expect(rows[1]).toEqual(["2", "3", "4"]);
	});
});

describe("buildCreateTableSql", () => {
	it("quotes identifiers and maps types", () => {
		const cols: CsvColumn[] = [
			{ name: "name", label: "Name", kind: "string", pgType: "text" },
			{ name: "amount", label: "Amount", kind: "number", pgType: "numeric" },
		];
		expect(buildCreateTableSql("up_abc123", "data", cols)).toBe(
			'CREATE TABLE "up_abc123"."data" ("name" text, "amount" numeric)',
		);
	});
});
