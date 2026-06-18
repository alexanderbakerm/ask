/**
 * Integration test for the organization.dataSource router: drives the full
 * create → test → introspect → persist → getCatalog → delete path against a
 * REAL source database, closing the 0.4 verification gap.
 *
 * Gated: lives under tests/trpc/routers/** (excluded unless RUN_DB_TESTS=true,
 * which also requires Docker). The app DB comes from the global test container;
 * a second container stands in for the connected analytics source.
 *
 *   RUN_DB_TESTS=true npm run test:db -- tests/trpc/routers/organization-datasource.test.ts
 */

import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { executeAskBiQuery } from "@/lib/ai/askbi/execute";
import {
	dataSourceTable,
	db,
	organizationTable,
	queryRunTable,
	userTable,
} from "@/lib/db";
import { createTestTRPCContext } from "@/tests/support/trpc-utils";
import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/app";

const testUser = {
	id: "00000000-0000-0000-0000-0000000000d5",
	email: "ds-test@example.com",
	name: "DS Test User",
	role: "user",
	emailVerified: true,
	createdAt: new Date(),
	updatedAt: new Date(),
	image: null,
	username: "ds-test",
	banned: false,
	banReason: null,
	banExpires: null,
	onboardingComplete: false,
	twoFactorEnabled: false,
};
const testOrgId = "00000000-0000-0000-0000-00000000da7a";

vi.mock("next/headers", () => ({ headers: () => new Headers() }));

// Authenticated, owner-of-active-org session.
vi.mock("@/lib/auth/server", () => ({
	getSession: async () => ({
		user: testUser,
		session: {
			id: "test-session-id",
			userId: testUser.id,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60),
			activeOrganizationId: testOrgId,
			token: "test-token",
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: null,
			userAgent: null,
			impersonatedBy: null,
		},
	}),
	assertUserIsOrgMember: async () => ({
		organization: {
			id: testOrgId,
			name: "Test Org",
			members: [{ userId: testUser.id, role: "owner" }],
		},
		membership: { userId: testUser.id, role: "owner" },
	}),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth")>();
	return {
		...actual,
		auth: {
			...actual.auth,
			api: { ...actual.auth.api, listOrganizations: async () => [] },
		},
	};
});

let source: StartedPostgreSqlContainer;

beforeAll(async () => {
	source = await new PostgreSqlContainer("postgres:16-alpine").start();
	const client = new Client({ connectionString: source.getConnectionUri() });
	await client.connect();
	// Demo-shaped source in a NON-public schema, to exercise schema scoping.
	await client.query(`
		CREATE SCHEMA sales;
		CREATE TABLE sales.products (
			id serial PRIMARY KEY,
			name text NOT NULL,
			category text
		);
		CREATE TABLE sales.orders (
			id serial PRIMARY KEY,
			product_id integer NOT NULL REFERENCES sales.products(id),
			amount numeric(10,2) NOT NULL,
			order_date date NOT NULL
		);
		INSERT INTO sales.products (name, category) VALUES
			('A', 'Hardware'), ('B', 'Hardware'), ('C', 'Software');
		INSERT INTO sales.orders (product_id, amount, order_date) VALUES
			(1, 10, '2025-10-01'), (1, 20, '2025-11-01'),
			(2, 5, '2025-12-01'), (3, 2.5, '2025-10-15');
	`);
	await client.end();
}, 120_000);

afterAll(async () => {
	await source?.stop();
});

describe("organization.dataSource (integration)", () => {
	it("creates, introspects, persists, lists, and deletes a source", async () => {
		// FKs (organizationId, createdBy) require these rows to exist.
		await db
			.insert(userTable)
			.values({
				id: testUser.id,
				email: testUser.email,
				name: testUser.name,
				emailVerified: true,
				createdAt: testUser.createdAt,
				updatedAt: testUser.updatedAt,
				image: null,
				username: testUser.username,
				role: "user",
				banned: false,
				banReason: null,
				banExpires: null,
				onboardingComplete: false,
			})
			.onConflictDoNothing();
		await db
			.insert(organizationTable)
			.values({ id: testOrgId, name: "Test Org" })
			.onConflictDoNothing();

		const caller = createCallerFactory(appRouter)(
			createTestTRPCContext(testUser),
		);

		// create → connects, introspects the `sales` schema, persists the catalog
		const created = await caller.organization.dataSource.create({
			name: "Demo Source",
			type: "postgres",
			connection: {
				host: source.getHost(),
				port: source.getPort(),
				database: source.getDatabase(),
				user: source.getUsername(),
				password: source.getPassword(),
				ssl: false,
				schemas: ["sales"],
			},
		});
		expect(created.dataSource.status).toBe("connected");
		expect(created.dataSource.hasCredentials).toBe(true);
		// Never leak the secret in any form.
		expect(JSON.stringify(created.dataSource)).not.toContain(
			source.getPassword(),
		);
		expect(created.dataSource.config.schemas).toEqual(["sales"]);
		const id = created.dataSource.id;

		// getCatalog → persisted, schema-qualified catalog
		const { catalog } = await caller.organization.dataSource.getCatalog({ id });
		const tableNames = catalog.tables.map((t) => t.name);
		expect(tableNames).toContain("products");
		expect(tableNames).toContain("orders");
		const products = catalog.tables.find((t) => t.name === "products");
		expect(products?.columns.map((c) => c.name)).toContain("category");

		// test → ok
		const tested = await caller.organization.dataSource.test({ id });
		expect(tested.ok).toBe(true);

		// execute → validate → audit: the 1.3 chokepoint, end-to-end
		const row = await db.query.dataSourceTable.findFirst({
			where: eq(dataSourceTable.id, id),
		});
		if (!row) throw new Error("data source row not found");

		// Valid grounded query → success; roles come from the executed SQL.
		const good = await executeAskBiQuery({
			dataSource: row,
			sql: "SELECT category, COUNT(*) AS n FROM sales.products GROUP BY category",
			question: "How many products per category?",
			userId: testUser.id,
		});
		if (good.status !== "success") {
			throw new Error(`expected success, got ${good.status}: ${good.error}`);
		}
		expect(good.rowCount).toBe(2); // Hardware, Software
		expect(good.outputRoles.category).toBe("dimension");
		expect(good.outputRoles.n).toBe("measure");

		// Invented column → rejected before the connector, and audited.
		const badColumn = await executeAskBiQuery({
			dataSource: row,
			sql: "SELECT made_up_column FROM sales.products",
			userId: testUser.id,
		});
		expect(badColumn.status).toBe("validation_rejected");
		if (badColumn.status !== "success") {
			expect(badColumn.category).toBe("catalog");
		}

		// Non-SELECT → rejected by the SELECT-only layer.
		const write = await executeAskBiQuery({
			dataSource: row,
			sql: "DELETE FROM sales.products",
			userId: testUser.id,
		});
		expect(write.status).toBe("validation_rejected");

		// Every attempt — the success AND both rejections — is in the audit log.
		const runs = await db.query.queryRunTable.findMany({
			where: eq(queryRunTable.organizationId, testOrgId),
		});
		const statuses = runs.map((r) => r.status);
		expect(statuses).toContain("success");
		expect(
			statuses.filter((s) => s === "validation_rejected").length,
		).toBeGreaterThanOrEqual(2);
		const rejected = runs.find((r) => r.status === "validation_rejected");
		expect(rejected?.generatedSql).toBeTruthy();
		expect(rejected?.error).toBeTruthy();

		// save → reopen (re-executes through the chokepoint for fresh data)
		const savedRes = await caller.organization.savedQuery.save({
			name: "Products per category",
			dataSourceId: id,
			question: "How many products per category?",
			sql: "SELECT category, COUNT(*) AS n FROM sales.products GROUP BY category",
			intent: "comparison",
			vizType: "bar",
			columns: [
				{ key: "category", label: "Category", dataType: "string" },
				{ key: "n", label: "N", dataType: "number" },
			],
		});
		const savedId = savedRes.savedQuery.id;
		const listed = await caller.organization.savedQuery.list();
		expect(listed.savedQueries.map((s) => s.id)).toContain(savedId);

		const reopened = await caller.organization.savedQuery.open({ id: savedId });
		if (!reopened.ok) {
			throw new Error(`expected reopen to succeed: ${reopened.error}`);
		}
		expect(reopened.answer.primary.type).toBe("bar");
		expect(reopened.asOf).toBeTruthy();

		// Schema drift → honest failure: drop the column, reintrospect so the
		// catalog reflects it, then the catalog validator catches the stale SQL.
		const drift = new Client({ connectionString: source.getConnectionUri() });
		await drift.connect();
		await drift.query("ALTER TABLE sales.products DROP COLUMN category");
		await drift.end();
		await caller.organization.dataSource.reintrospect({ id });

		const afterDrift = await caller.organization.savedQuery.open({
			id: savedId,
		});
		expect(afterDrift.ok).toBe(false);
		if (!afterDrift.ok) {
			expect(afterDrift.error).toMatch(/no longer matches|schema/i);
		}

		// list includes it, delete removes it
		const before = await caller.organization.dataSource.list();
		expect(before.dataSources.map((d) => d.id)).toContain(id);

		await caller.organization.dataSource.delete({ id });
		const after = await caller.organization.dataSource.list();
		expect(after.dataSources.map((d) => d.id)).not.toContain(id);
	});
});
