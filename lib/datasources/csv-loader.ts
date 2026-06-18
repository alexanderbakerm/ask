import "server-only";

import { randomUUID } from "node:crypto";
import { Client, type ClientConfig } from "pg";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildCreateTableSql, coerceValue, parseCsv } from "./csv-import";
import type { StoredConfig } from "./service";

/**
 * Loads an imported CSV into a Postgres table the app owns, then hands back the
 * (read-only) connection config so it can be registered as a normal data source.
 *
 * Two roles, deliberately separated:
 *   - the ADMIN role creates the uploads DB/schema/table and inserts the rows —
 *     write access, used only here at import time;
 *   - the READ-ONLY role (ASKBI_READONLY_*) is granted SELECT and is the only
 *     credential AskBI ever queries with, so the SELECT-only guarantee holds for
 *     uploaded data exactly as it does for external Postgres sources.
 *
 * Every identifier is generated/sanitized (schema `up_<rand>`, table `data`,
 * columns snake-cased) and quoted; every value is bound as a parameter — no
 * CSV content reaches SQL as text.
 *
 * PRODUCTION NOTE: on managed Postgres (Supabase), CSVs are stored in isolated
 * schemas inside the main database (pooler URL). Locally, a dedicated
 * `askbi_uploads` database may be created instead.
 */

const MAX_ROWS = 100_000;
const INSERT_BATCH = 500;

// Resolve with explicit fallbacks rather than relying on env-schema defaults:
// this project runs with SKIP_ENV_VALIDATION set, so zod `.default()` values are
// NOT applied at runtime. These local defaults match the demo seed.
const RO_USER = env.ASKBI_READONLY_USER || "askbi_readonly";
const RO_PASS = env.ASKBI_READONLY_PASSWORD || "askbi_readonly_password";

interface UploadsConnectionProfile {
	adminConfig: (database: string) => ClientConfig;
	uploadsDatabase: string;
	stored: Pick<StoredConfig, "host" | "port" | "database" | "ssl">;
	skipCreateDatabase: boolean;
}

function parsePostgresUrl(urlString: string): URL {
	return new URL(urlString.replace(/^postgres:\/\//, "postgresql://"));
}

function urlRequiresSsl(url: URL): boolean {
	const sslmode = url.searchParams.get("sslmode");
	return (
		sslmode === "require" ||
		sslmode === "verify-full" ||
		sslmode === "verify-ca"
	);
}

function isLocalHost(host: string): boolean {
	return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Prefer POSTGRES_URL_NON_POOLING / DATABASE_URL over POSTGRES_HOST.
 * Supabase sets POSTGRES_HOST to db.<ref>.supabase.co (often unreachable from
 * serverless) while the pooler hostname in the URL works.
 */
function resolveUploadsConnectionProfile(): UploadsConnectionProfile {
	const urlString =
		process.env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || undefined;

	if (urlString) {
		const url = parsePostgresUrl(urlString);
		const host = url.hostname;
		const port = Number(url.port || "5432");
		const defaultDatabase =
			url.pathname.replace(/^\//, "") ||
			process.env.POSTGRES_DATABASE ||
			env.POSTGRES_DB ||
			"postgres";
		const ssl = urlRequiresSsl(url) || !isLocalHost(host);
		const skipCreateDatabase = !isLocalHost(host);
		const uploadsDatabase = skipCreateDatabase
			? defaultDatabase
			: env.ASKBI_UPLOADS_DB || "askbi_uploads";

		return {
			adminConfig: (database: string): ClientConfig => ({
				connectionString: urlString,
				database,
				ssl: ssl ? { rejectUnauthorized: false } : undefined,
			}),
			uploadsDatabase,
			stored: { host, port, database: uploadsDatabase, ssl },
			skipCreateDatabase,
		};
	}

	const uploadsDatabase = env.ASKBI_UPLOADS_DB || "askbi_uploads";
	const host = env.POSTGRES_HOST || "localhost";
	const port = Number(env.POSTGRES_PORT || "5432");

	return {
		adminConfig: (database: string): ClientConfig => ({
			host,
			port,
			user: env.POSTGRES_USER || "postgres",
			password: env.POSTGRES_PASSWORD || "password",
			database,
			ssl: false,
		}),
		uploadsDatabase,
		stored: { host, port, database: uploadsDatabase, ssl: false },
		skipCreateDatabase: false,
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
async function ensureUploadsDatabase(
	profile: UploadsConnectionProfile,
): Promise<void> {
	const roUser = RO_USER;
	const roPass = RO_PASS;
	const uploadsDb = profile.uploadsDatabase;
	const maint = new Client(profile.adminConfig("postgres"));
	await maint.connect();
	try {
		await maint.query(
			`DO $$ BEGIN
			   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${lit(roUser)}) THEN
			     CREATE ROLE ${q(roUser)} LOGIN PASSWORD ${lit(roPass)};
			   END IF;
			 END $$;`,
		);
		if (!profile.skipCreateDatabase) {
			const exists = await maint.query(
				"SELECT 1 FROM pg_database WHERE datname = $1",
				[uploadsDb],
			);
			if (exists.rowCount === 0) {
				await maint.query(`CREATE DATABASE ${q(uploadsDb)}`);
			}
		}
		await maint.query(
			`GRANT CONNECT ON DATABASE ${q(uploadsDb)} TO ${q(roUser)}`,
		);
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
	const profile = resolveUploadsConnectionProfile();
	const uploadsDb = profile.uploadsDatabase;

	await ensureUploadsDatabase(profile);

	const client = new Client(profile.adminConfig(uploadsDb));
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
			...profile.stored,
			user: roUser,
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
	const profile = resolveUploadsConnectionProfile();
	const client = new Client(profile.adminConfig(profile.uploadsDatabase));
	await client.connect();
	try {
		await client.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`);
	} catch (error) {
		logger.warn({ error, schema }, "AskBI CSV import: failed to drop schema");
	} finally {
		await client.end();
	}
}
