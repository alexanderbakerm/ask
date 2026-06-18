import "server-only";

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildCreateTableSql, coerceValue, parseCsv } from "./csv-import";
import type { StoredConfig } from "./service";

/**
 * Loads an imported CSV into a Postgres table the app owns, then hands back the
 * (read-only) connection config so it can be registered as a normal data source.
 *
 * Two roles, deliberately separated:
 *   - the ADMIN role (POSTGRES_*) creates the uploads DB/schema/table and inserts
 *     the rows — write access, used only here at import time;
 *   - the READ-ONLY role (ASKBI_READONLY_*) is granted SELECT and is the only
 *     credential AskBI ever queries with, so the SELECT-only guarantee holds for
 *     uploaded data exactly as it does for external Postgres sources.
 *
 * Every identifier is generated/sanitized (schema `up_<rand>`, table `data`,
 * columns snake-cased) and quoted; every value is bound as a parameter — no
 * CSV content reaches SQL as text.
 *
 * PRODUCTION NOTE: locally this loads into the app's own Postgres instance
 * (ssl off). In production, point ASKBI_UPLOADS_DB at an ISOLATED database with
 * per-org isolation — see the AskBI security backlog (TLS/SSRF/isolation).
 */

const MAX_ROWS = 100_000;
const INSERT_BATCH = 500;

// Resolve with explicit fallbacks rather than relying on env-schema defaults:
// this project runs with SKIP_ENV_VALIDATION set, so zod `.default()` values are
// NOT applied at runtime. These local defaults match the demo seed.
const UPLOADS_DB = env.ASKBI_UPLOADS_DB || "askbi_uploads";
const RO_USER = env.ASKBI_READONLY_USER || "askbi_readonly";
const RO_PASS = env.ASKBI_READONLY_PASSWORD || "askbi_readonly_password";

function adminConn(database: string) {
	return {
		host: env.POSTGRES_HOST || "localhost",
		port: Number(env.POSTGRES_PORT || "5432"),
		user: env.POSTGRES_USER || "postgres",
		password: env.POSTGRES_PASSWORD || "password",
		database,
	};
}

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;
const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`;

export interface CsvLoadResult {
	config: StoredConfig;
	secrets: { password: string };
	rowCount: number;
	truncated: boolean;
	tableLabel: string;
}

/** Create the uploads DB (if missing) + ensure the read-only login role exists. */
async function ensureUploadsDatabase(): Promise<void> {
	const roUser = RO_USER;
	const roPass = RO_PASS;
	const uploadsDb = UPLOADS_DB;
	const maint = new Client(adminConn("postgres"));
	await maint.connect();
	try {
		await maint.query(
			`DO $$ BEGIN
			   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${lit(roUser)}) THEN
			     CREATE ROLE ${q(roUser)} LOGIN PASSWORD ${lit(roPass)};
			   END IF;
			 END $$;`,
		);
		const exists = await maint.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[uploadsDb],
		);
		if (exists.rowCount === 0) {
			await maint.query(`CREATE DATABASE ${q(uploadsDb)}`);
		}
		await maint.query(`GRANT CONNECT ON DATABASE ${q(uploadsDb)} TO ${q(roUser)}`);
	} finally {
		await maint.end();
	}
}

/**
 * Parse + load a CSV. Returns the read-only connection config to register.
 * Throws on an unusable CSV (no columns / no rows).
 */
export async function loadCsvSource(
	csvText: string,
	hasHeader: boolean,
): Promise<CsvLoadResult> {
	const { columns, rows } = parseCsv(csvText, hasHeader);
	if (columns.length === 0) {
		throw new Error("The file has no columns.");
	}
	if (rows.length === 0) {
		throw new Error("The file has no data rows.");
	}

	const truncated = rows.length > MAX_ROWS;
	const dataRows = truncated ? rows.slice(0, MAX_ROWS) : rows;

	const schema = `up_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
	const table = "data";
	const roUser = RO_USER;
	const uploadsDb = UPLOADS_DB;

	await ensureUploadsDatabase();

	const client = new Client(adminConn(uploadsDb));
	await client.connect();
	try {
		await client.query(`CREATE SCHEMA IF NOT EXISTS ${q(schema)}`);
		await client.query(buildCreateTableSql(schema, table, columns));

		const colList = columns.map((c) => q(c.name)).join(", ");
		const insertHead = `INSERT INTO ${q(schema)}.${q(table)} (${colList}) VALUES `;
		for (let start = 0; start < dataRows.length; start += INSERT_BATCH) {
			const batch = dataRows.slice(start, start + INSERT_BATCH);
			const params: unknown[] = [];
			const tuples = batch.map((row) => {
				const placeholders = columns.map((col, i) => {
					params.push(coerceValue(row[i] ?? "", col.kind));
					return `$${params.length}`;
				});
				return `(${placeholders.join(", ")})`;
			});
			await client.query(insertHead + tuples.join(", "), params);
		}

		await client.query(`GRANT USAGE ON SCHEMA ${q(schema)} TO ${q(roUser)}`);
		await client.query(
			`GRANT SELECT ON ALL TABLES IN SCHEMA ${q(schema)} TO ${q(roUser)}`,
		);
	} finally {
		await client.end();
	}

	logger.info(
		{ schema, rows: dataRows.length, columns: columns.length },
		"AskBI CSV import: loaded into uploads database",
	);

	return {
		config: {
			host: env.POSTGRES_HOST,
			port: Number(env.POSTGRES_PORT),
			database: uploadsDb,
			user: roUser,
			ssl: false,
			schemas: [schema],
		},
		secrets: { password: RO_PASS },
		rowCount: dataRows.length,
		truncated,
		tableLabel: table,
	};
}

/** Drop an imported CSV's schema (called when its data source is deleted). */
export async function dropUploadsSchema(schema: string): Promise<void> {
	if (!/^up_[a-z0-9]+$/.test(schema)) return; // only our generated schemas
	const client = new Client(adminConn(UPLOADS_DB));
	await client.connect();
	try {
		await client.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`);
	} catch (error) {
		logger.warn({ error, schema }, "AskBI CSV import: failed to drop schema");
	} finally {
		await client.end();
	}
}
