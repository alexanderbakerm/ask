import { describe, expect, it } from "vitest";
import {
	analyzeSql,
	type ValidationCatalog,
	validateSqlAgainstCatalog,
} from "./validate-against-catalog";

const catalog: ValidationCatalog = {
	tables: [
		{
			schema: "sales",
			table: "orders",
			columns: ["id", "product_id", "order_date", "quantity", "amount"],
		},
		{
			schema: "sales",
			table: "products",
			columns: ["id", "name", "category", "unit_price"],
		},
	],
};

const ok = (sql: string) => validateSqlAgainstCatalog(sql, catalog).ok;

describe("validateAgainstCatalog — accepts grounded queries", () => {
	it("a join + GROUP BY over real tables/columns", () => {
		expect(
			ok(
				"SELECT p.category AS category, SUM(o.amount) AS revenue FROM sales.orders o JOIN sales.products p ON p.id = o.product_id GROUP BY p.category",
			),
		).toBe(true);
	});

	it("an unqualified table name (resolved within allowed schema)", () => {
		expect(ok("SELECT amount FROM orders")).toBe(true);
	});

	it("a SELECT alias reused in ORDER BY (not a base column)", () => {
		expect(
			ok("SELECT SUM(amount) AS revenue FROM sales.orders ORDER BY revenue"),
		).toBe(true);
	});

	it("a CTE whose output alias is referenced in the outer query", () => {
		expect(
			ok(
				"WITH q AS (SELECT product_id, SUM(amount) AS revenue FROM sales.orders GROUP BY product_id) SELECT product_id, revenue FROM q",
			),
		).toBe(true);
	});

	it("date_trunc month grouping", () => {
		expect(
			ok(
				"SELECT date_trunc('month', order_date) AS month, SUM(amount) AS revenue FROM sales.orders GROUP BY 1 ORDER BY month",
			),
		).toBe(true);
	});
});

describe("validateAgainstCatalog — rejects invented schema", () => {
	it("an unknown table", () => {
		const r = validateSqlAgainstCatalog(
			"SELECT * FROM sales.customers",
			catalog,
		);
		expect(r.ok).toBe(false);
		expect(r.unknownTables).toContain("sales.customers");
	});

	it("a table in the wrong schema", () => {
		const r = validateSqlAgainstCatalog(
			"SELECT id FROM public.orders",
			catalog,
		);
		expect(r.ok).toBe(false);
		expect(r.unknownTables).toContain("public.orders");
	});

	it("a qualified unknown column (the hallucination case)", () => {
		const r = validateSqlAgainstCatalog(
			"SELECT o.revenue FROM sales.orders o",
			catalog,
		);
		expect(r.ok).toBe(false);
		expect(r.unknownColumns).toContain("orders.revenue");
	});

	it("an unqualified unknown column", () => {
		const r = validateSqlAgainstCatalog(
			"SELECT made_up_column FROM sales.orders",
			catalog,
		);
		expect(r.ok).toBe(false);
		expect(r.unknownColumns).toContain("made_up_column");
	});

	it("an unknown table referenced inside a CTE body", () => {
		const r = validateSqlAgainstCatalog(
			"WITH q AS (SELECT * FROM sales.nope) SELECT * FROM q",
			catalog,
		);
		expect(r.ok).toBe(false);
		expect(r.unknownTables).toContain("sales.nope");
	});
});

describe("analyzeSql — structure-derived output roles", () => {
	it("GROUP BY key → dimension, aggregate → measure", () => {
		const a = analyzeSql(
			"SELECT p.category AS category, SUM(o.amount) AS revenue FROM sales.orders o JOIN sales.products p ON p.id = o.product_id GROUP BY p.category",
			"postgresql",
		);
		expect(a.hasGroupBy).toBe(true);
		expect(a.outputRoles.category).toBe("dimension");
		expect(a.outputRoles.revenue).toBe("measure");
	});

	it("date_trunc output → time, even with an integer GROUP BY ordinal", () => {
		const a = analyzeSql(
			"SELECT date_trunc('month', order_date) AS month, SUM(amount) AS revenue FROM sales.orders GROUP BY 1",
			"postgresql",
		);
		expect(a.outputRoles.month).toBe("time");
		expect(a.outputRoles.revenue).toBe("measure");
	});

	it("no GROUP BY → no structural role for bare columns (defer to fallback)", () => {
		const a = analyzeSql("SELECT id, amount FROM sales.orders", "postgresql");
		expect(a.hasGroupBy).toBe(false);
		expect(a.outputRoles.id).toBeUndefined();
		expect(a.outputRoles.amount).toBeUndefined();
	});
});
