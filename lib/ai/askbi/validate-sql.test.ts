import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "./validate-sql";

describe("validateReadOnlySql — allows reads", () => {
	const allowed = [
		"SELECT 1",
		"SELECT * FROM orders",
		"SELECT product_id, SUM(amount) AS total FROM orders GROUP BY product_id",
		"SELECT o.id, p.name FROM orders o JOIN products p ON p.id = o.product_id WHERE o.created_at >= '2024-10-01'",
		"SELECT date_trunc('month', created_at) AS month, COUNT(*) FROM orders GROUP BY 1 ORDER BY 1",
		"WITH q4 AS (SELECT * FROM orders WHERE quarter = 4) SELECT product_id, SUM(amount) FROM q4 GROUP BY product_id",
		"SELECT * FROM orders LIMIT 100",
		"SELECT (SELECT COUNT(*) FROM products) AS product_count",
	];

	for (const sql of allowed) {
		it(`allows: ${sql.slice(0, 50)}`, () => {
			const result = validateReadOnlySql(sql);
			expect(result.ok, result.reason).toBe(true);
			expect(result.statementType).toBe("select");
		});
	}
});

describe("validateReadOnlySql — rejects writes & DDL", () => {
	const rejected = [
		"INSERT INTO orders (id) VALUES (1)",
		"UPDATE orders SET amount = 0",
		"DELETE FROM orders",
		"DROP TABLE orders",
		"TRUNCATE orders",
		"ALTER TABLE orders ADD COLUMN x int",
		"CREATE TABLE evil (id int)",
		"GRANT ALL ON orders TO public",
	];

	for (const sql of rejected) {
		it(`rejects: ${sql.slice(0, 40)}`, () => {
			expect(validateReadOnlySql(sql).ok).toBe(false);
		});
	}
});

describe("validateReadOnlySql — rejects stacked statements", () => {
	it("rejects a SELECT followed by a DROP", () => {
		const result = validateReadOnlySql("SELECT 1; DROP TABLE orders");
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/multiple statements/i);
	});

	it("rejects two SELECTs", () => {
		expect(validateReadOnlySql("SELECT 1; SELECT 2").ok).toBe(false);
	});
});

describe("validateReadOnlySql — rejects DML hidden in a CTE", () => {
	// Postgres data-modifying CTEs are rejected fail-closed: node-sql-parser
	// refuses to parse them, so they never reach execution. (If a future
	// dialect/version did parse them, the recursive AST walk would still catch
	// the nested DELETE/INSERT node.)
	it("rejects WITH ( DELETE ... RETURNING ) SELECT", () => {
		const sql =
			"WITH gone AS (DELETE FROM orders RETURNING *) SELECT * FROM gone";
		expect(validateReadOnlySql(sql).ok).toBe(false);
	});

	it("rejects WITH ( INSERT ... RETURNING ) SELECT", () => {
		const sql =
			"WITH ins AS (INSERT INTO orders (id) VALUES (1) RETURNING *) SELECT * FROM ins";
		expect(validateReadOnlySql(sql).ok).toBe(false);
	});
});

describe("validateReadOnlySql — rejects dangerous functions", () => {
	it("rejects pg_sleep", () => {
		const result = validateReadOnlySql("SELECT pg_sleep(10)");
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/pg_sleep/i);
	});

	it("rejects pg_read_file", () => {
		expect(validateReadOnlySql("SELECT pg_read_file('/etc/passwd')").ok).toBe(
			false,
		);
	});

	it("rejects schema-qualified pg_catalog.pg_sleep", () => {
		expect(validateReadOnlySql("SELECT pg_catalog.pg_sleep(5)").ok).toBe(false);
	});

	it("allows ordinary aggregate functions", () => {
		expect(
			validateReadOnlySql("SELECT COUNT(*), AVG(amount) FROM orders").ok,
		).toBe(true);
	});
});

describe("validateReadOnlySql — misc", () => {
	it("rejects empty input", () => {
		expect(validateReadOnlySql("   ").ok).toBe(false);
	});

	it("rejects unparseable input (fail closed)", () => {
		expect(validateReadOnlySql("this is not sql at all !!!").ok).toBe(false);
	});

	it("tolerates a trailing semicolon on a single SELECT", () => {
		expect(validateReadOnlySql("SELECT 1;").ok).toBe(true);
	});
});

describe("validateReadOnlySql — ORDER BY direction (DESC regression)", () => {
	it("allows ORDER BY ... DESC (node-sql-parser tags the direction node 'DESC')", () => {
		expect(
			validateReadOnlySql(
				"SELECT category, SUM(amount) AS total FROM orders GROUP BY 1 ORDER BY 2 DESC LIMIT 25",
			).ok,
		).toBe(true);
	});

	it("allows ORDER BY ... ASC", () => {
		expect(validateReadOnlySql("SELECT a FROM t ORDER BY a ASC").ok).toBe(true);
	});

	it("still rejects a DESCRIBE statement (blocked by the select-only check)", () => {
		expect(validateReadOnlySql("DESCRIBE orders", "mysql").ok).toBe(false);
	});
});
