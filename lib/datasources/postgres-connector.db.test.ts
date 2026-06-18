/**
 * Integration tests for PostgresConnector against a real PostgreSQL instance.
 *
 * Gated: the filename matches the vitest `*db*.test.ts` exclusion, so this file
 * only runs under `RUN_DB_TESTS=true` (which also requires Docker). Run with:
 *
 *   RUN_DB_TESTS=true npm run test:db
 */

import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresConnector } from "./postgres-connector";

let container: StartedPostgreSqlContainer;
let connector: PostgresConnector;

beforeAll(async () => {
	container = await new PostgreSqlContainer("postgres:16-alpine").start();

	// Seed a small orders/products schema using a privileged (read-write) client.
	const client = new Client({ connectionString: container.getConnectionUri() });
	await client.connect();
	await client.query(`
		CREATE TABLE products (
			id serial PRIMARY KEY,
			name text NOT NULL,
			category text
		);
		CREATE TABLE orders (
			id serial PRIMARY KEY,
			product_id integer NOT NULL REFERENCES products(id),
			amount numeric(10,2) NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now()
		);
		INSERT INTO products (name, category) VALUES
			('Widget', 'hardware'), ('Gadget', 'hardware'), ('eBook', 'digital');
		INSERT INTO orders (product_id, amount) VALUES
			(1, 10.00), (1, 20.00), (2, 5.00), (3, 2.50), (3, 2.50);
	`);
	await client.end();

	connector = new PostgresConnector({
		host: container.getHost(),
		port: container.getPort(),
		database: container.getDatabase(),
		user: container.getUsername(),
		password: container.getPassword(),
		ssl: false,
		schemas: ["public"],
	});
}, 120_000);

afterAll(async () => {
	await connector?.close();
	await container?.stop();
});

describe("PostgresConnector.testConnection", () => {
	it("connects and reports the server version", async () => {
		const result = await connector.testConnection();
		expect(result.ok).toBe(true);
		expect(result.serverVersion).toMatch(/PostgreSQL/i);
		expect(typeof result.latencyMs).toBe("number");
	});
});

describe("PostgresConnector.introspect", () => {
	it("returns tables, columns, PKs, FKs, and categorical stats", async () => {
		const catalog = await connector.introspect();
		expect(catalog.dialect).toBe("postgresql");

		const products = catalog.tables.find((t) => t.name === "products");
		const orders = catalog.tables.find((t) => t.name === "orders");
		expect(products).toBeDefined();
		expect(orders).toBeDefined();

		// Column types normalized
		const id = products?.columns.find((c) => c.name === "id");
		const category = products?.columns.find((c) => c.name === "category");
		const amount = orders?.columns.find((c) => c.name === "amount");
		const createdAt = orders?.columns.find((c) => c.name === "created_at");
		expect(id?.normalizedType).toBe("number");
		expect(id?.isPrimaryKey).toBe(true);
		expect(category?.normalizedType).toBe("string");
		expect(amount?.normalizedType).toBe("number");
		expect(createdAt?.normalizedType).toBe("datetime");

		// Foreign key orders.product_id -> products.id
		const fk = orders?.foreignKeys.find((f) => f.column === "product_id");
		expect(fk?.referencesTable).toBe("products");
		expect(fk?.referencesColumn).toBe("id");

		// Cheap categorical stats on a low-cardinality column
		expect(category?.distinctCount).toBe(2);
		expect(category?.sampleValues).toEqual(
			expect.arrayContaining(["hardware", "digital"]),
		);
	});
});

describe("PostgresConnector.runQuery", () => {
	it("executes a read and returns rows + columns", async () => {
		const result = await connector.runQuery(
			"SELECT product_id, SUM(amount) AS total FROM orders GROUP BY product_id ORDER BY product_id",
			{ maxRows: 1000, timeoutMs: 5000 },
		);
		expect(result.columns.map((c) => c.name)).toEqual(["product_id", "total"]);
		expect(result.rows).toHaveLength(3);
		expect(result.truncated).toBe(false);
	});

	it("reports truncated=true when the row cap is hit", async () => {
		const result = await connector.runQuery("SELECT * FROM orders", {
			maxRows: 2,
			timeoutMs: 5000,
		});
		expect(result.rows).toHaveLength(2);
		expect(result.truncated).toBe(true);
	});

	it("clamps a pre-existing inner LIMIT without amplifying it", async () => {
		const result = await connector.runQuery(
			"SELECT * FROM orders ORDER BY id LIMIT 1",
			{ maxRows: 10, timeoutMs: 5000 },
		);
		expect(result.rows).toHaveLength(1);
		expect(result.truncated).toBe(false);
	});

	it("refuses a write even on a read-write connection (READ ONLY tx)", async () => {
		// A data-modifying CTE is valid SQL inside a subquery, so it reaches the
		// transaction and is refused by READ ONLY — proving the connector's own
		// guard, independent of the AST validator and the read-only grant.
		await expect(
			connector.runQuery(
				"WITH ins AS (INSERT INTO products (name) VALUES ('evil') RETURNING id) SELECT * FROM ins",
				{ maxRows: 10, timeoutMs: 5000 },
			),
		).rejects.toThrow(/read-only|read only/i);

		// And nothing was written.
		const after = await connector.runQuery(
			"SELECT count(*) AS n FROM products",
			{
				maxRows: 10,
				timeoutMs: 5000,
			},
		);
		expect(Number((after.rows[0] as { n: string }).n)).toBe(3);
	});

	it("aborts a slow query via the statement timeout", async () => {
		await expect(
			connector.runQuery("SELECT pg_sleep(2)", {
				maxRows: 10,
				timeoutMs: 300,
			}),
		).rejects.toThrow(/timeout|canceling statement/i);
	});
});
