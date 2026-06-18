import "server-only";

import { Pool, type PoolClient, type PoolConfig } from "pg";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import { sanitizeDbError } from "./errors";
import { wrapWithRowLimit } from "./sql-limit";
import { normalizePgType } from "./type-mapping";
import type {
	Catalog,
	DataSourceConnector,
	IntrospectedColumn,
	IntrospectedTable,
	QueryResult,
	RunQueryOptions,
	SqlDialect,
	TestConnectionResult,
} from "./types";

export interface PostgresConnectionParams {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	/** Require TLS. When true we encrypt but do not (yet) pin the CA cert. */
	ssl: boolean;
	/** Schemas to introspect / query within. Defaults to ["public"]. */
	schemas?: string[];
}

export interface IntrospectionOptions {
	schemas: string[];
	/** Whether to gather cheap distinct/sample stats for categorical columns. */
	collectStats: boolean;
	/** Rows to sample per column for stats (bounds the scan; never a full scan). */
	sampleRows: number;
	/** Cap on the number of sample values returned per column. */
	maxSampleValues: number;
	/** Skip stats on tables estimated larger than this (cost guard). */
	statsMaxTableRows: number;
	/** Per-stats-query statement timeout (ms). */
	statsTimeoutMs: number;
	/** Statement timeout for the structural metadata queries (ms). */
	structureTimeoutMs: number;
}

const DEFAULT_INTROSPECTION: IntrospectionOptions = {
	schemas: ["public"],
	collectStats: true,
	sampleRows: 10_000,
	maxSampleValues: 20,
	statsMaxTableRows: 5_000_000,
	statsTimeoutMs: 4_000,
	structureTimeoutMs: 15_000,
};

// Connection-level guards (defense-in-depth alongside the per-query READ ONLY
// transaction). These cap any query/connection even outside an explicit tx.
const POOL_MAX_CLIENTS = 3;
const POOL_IDLE_TIMEOUT_MS = 10_000;
const POOL_CONNECTION_TIMEOUT_MS = 10_000;
const POOL_STATEMENT_TIMEOUT_MS = 30_000;
const POOL_IDLE_IN_TX_TIMEOUT_MS = 15_000;

/** Double-quote a SQL identifier (schema/table/column) safely. */
function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

// ---- Shapes of the introspection metadata queries ----
type TableRow = {
	schema: string;
	name: string;
	kind: string;
	row_estimate: string | null;
};
type ColumnRow = {
	schema: string;
	name: string;
	column_name: string;
	data_type: string;
	is_nullable: string;
	ordinal_position: number;
};
type PkRow = { schema: string; name: string; column_name: string };
type FkRow = {
	schema: string;
	name: string;
	column_name: string;
	ref_schema: string;
	ref_table: string;
	ref_column: string;
};
type StatsRow = { distinct_count: string | null; samples: string[] | null };

const TABLES_SQL = `
	SELECT n.nspname AS schema,
	       c.relname AS name,
	       c.relkind AS kind,
	       CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS row_estimate
	FROM pg_class c
	JOIN pg_namespace n ON n.oid = c.relnamespace
	WHERE n.nspname = ANY($1)
	  AND c.relkind IN ('r', 'p', 'v', 'm')
	ORDER BY n.nspname, c.relname`;

const COLUMNS_SQL = `
	SELECT table_schema AS schema,
	       table_name AS name,
	       column_name,
	       data_type,
	       is_nullable,
	       ordinal_position
	FROM information_schema.columns
	WHERE table_schema = ANY($1)
	ORDER BY table_schema, table_name, ordinal_position`;

const PK_SQL = `
	SELECT tc.table_schema AS schema,
	       tc.table_name AS name,
	       kcu.column_name
	FROM information_schema.table_constraints tc
	JOIN information_schema.key_column_usage kcu
	  ON tc.constraint_name = kcu.constraint_name
	 AND tc.table_schema = kcu.table_schema
	WHERE tc.constraint_type = 'PRIMARY KEY'
	  AND tc.table_schema = ANY($1)`;

const FK_SQL = `
	SELECT tc.table_schema AS schema,
	       tc.table_name AS name,
	       kcu.column_name AS column_name,
	       ccu.table_schema AS ref_schema,
	       ccu.table_name AS ref_table,
	       ccu.column_name AS ref_column
	FROM information_schema.table_constraints tc
	JOIN information_schema.key_column_usage kcu
	  ON tc.constraint_name = kcu.constraint_name
	 AND tc.table_schema = kcu.table_schema
	JOIN information_schema.constraint_column_usage ccu
	  ON ccu.constraint_name = tc.constraint_name
	 AND ccu.table_schema = tc.table_schema
	WHERE tc.constraint_type = 'FOREIGN KEY'
	  AND tc.table_schema = ANY($1)`;

/**
 * PostgreSQL connector. Connects with the data source's (read-only) credentials
 * and enforces, on every execution:
 *   1. a per-query `BEGIN READ ONLY` transaction — refuses writes even against a
 *      read-write connection (a third defense layer, on top of the AST
 *      validator and the read-only DB grant), and
 *   2. a `SET LOCAL statement_timeout` plus a mandatory injected row LIMIT.
 *
 * Callers MUST validate SQL with the SELECT-only validator before calling
 * {@link runQuery}; the read-only transaction is a backstop, not a substitute.
 */
export class PostgresConnector implements DataSourceConnector {
	readonly dialect: SqlDialect = "postgresql";
	private readonly pool: Pool;
	private readonly schemas: string[];

	constructor(params: PostgresConnectionParams) {
		this.schemas = params.schemas?.length ? params.schemas : ["public"];
		const config: PoolConfig = {
			host: params.host,
			port: params.port,
			database: params.database,
			user: params.user,
			password: params.password,
			ssl: params.ssl ? { rejectUnauthorized: false } : undefined,
			max: POOL_MAX_CLIENTS,
			idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
			connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
			statement_timeout: POOL_STATEMENT_TIMEOUT_MS,
			idle_in_transaction_session_timeout: POOL_IDLE_IN_TX_TIMEOUT_MS,
			application_name: "askbi",
		};
		this.pool = new Pool(config);
		// A pool 'error' on an idle client must be handled or it crashes the process.
		this.pool.on("error", (err) => {
			logger.error({ err }, "AskBI postgres pool error");
		});
	}

	async testConnection(): Promise<TestConnectionResult> {
		const start = Date.now();
		let client: PoolClient | undefined;
		try {
			client = await this.pool.connect();
			const res = await client.query<{ version: string }>(
				"SELECT version() AS version",
			);
			return {
				ok: true,
				latencyMs: Date.now() - start,
				serverVersion: res.rows[0]?.version,
			};
		} catch (error) {
			// Sanitized: testConnection's error is surfaced to the client/UI.
			return {
				ok: false,
				error: sanitizeDbError(error),
				latencyMs: Date.now() - start,
			};
		} finally {
			client?.release();
		}
	}

	async runQuery(sql: string, opts: RunQueryOptions): Promise<QueryResult> {
		const maxRows = Math.max(1, Math.floor(opts.maxRows));
		const timeoutMs = Math.max(100, Math.floor(opts.timeoutMs));
		// Fetch one extra row so we can report truncation honestly.
		const wrapped = wrapWithRowLimit(sql, maxRows + 1);
		const start = Date.now();

		return this.inReadOnlyTx(timeoutMs, async (client) => {
			const result = await client.query(wrapped);
			const truncated = result.rows.length > maxRows;
			const rows = (
				truncated ? result.rows.slice(0, maxRows) : result.rows
			) as Record<string, unknown>[];
			return {
				columns: result.fields.map((f) => ({ name: f.name })),
				rows,
				rowCount: rows.length,
				truncated,
				durationMs: Date.now() - start,
			};
		});
	}

	async introspect(options?: Partial<IntrospectionOptions>): Promise<Catalog> {
		const opts: IntrospectionOptions = {
			...DEFAULT_INTROSPECTION,
			schemas: this.schemas,
			...options,
		};

		// All structural metadata in a single read-only transaction.
		const { tables, columns, primaryKeys, foreignKeys } =
			await this.inReadOnlyTx(opts.structureTimeoutMs, async (client) => {
				const [t, c, pk, fk] = await Promise.all([
					client.query<TableRow>(TABLES_SQL, [opts.schemas]),
					client.query<ColumnRow>(COLUMNS_SQL, [opts.schemas]),
					client.query<PkRow>(PK_SQL, [opts.schemas]),
					client.query<FkRow>(FK_SQL, [opts.schemas]),
				]);
				return {
					tables: t.rows,
					columns: c.rows,
					primaryKeys: pk.rows,
					foreignKeys: fk.rows,
				};
			});

		const key = (schema: string, name: string) => `${schema}.${name}`;
		const tableMap = new Map<string, IntrospectedTable>();
		for (const t of tables) {
			tableMap.set(key(t.schema, t.name), {
				schema: t.schema,
				name: t.name,
				rowCountEstimate:
					t.row_estimate == null ? undefined : Number(t.row_estimate),
				columns: [],
				foreignKeys: [],
			});
		}

		const pkSet = new Set(
			primaryKeys.map((p) => `${p.schema}.${p.name}.${p.column_name}`),
		);

		for (const c of columns) {
			const table = tableMap.get(key(c.schema, c.name));
			if (!table) {
				continue; // column of a relation kind we don't surface
			}
			table.columns.push({
				name: c.column_name,
				dataType: c.data_type,
				normalizedType: normalizePgType(c.data_type),
				isNullable: c.is_nullable === "YES",
				isPrimaryKey: pkSet.has(`${c.schema}.${c.name}.${c.column_name}`),
				ordinalPosition: c.ordinal_position,
			});
		}

		for (const fk of foreignKeys) {
			const table = tableMap.get(key(fk.schema, fk.name));
			if (!table) {
				continue;
			}
			table.foreignKeys.push({
				column: fk.column_name,
				referencesSchema: fk.ref_schema,
				referencesTable: fk.ref_table,
				referencesColumn: fk.ref_column,
			});
		}

		const result = Array.from(tableMap.values());

		if (opts.collectStats) {
			await this.collectColumnStats(result, opts);
		}

		return { dialect: this.dialect, tables: result };
	}

	async close(): Promise<void> {
		await this.pool.end();
	}

	/**
	 * Cheap, bounded categorical stats. Per column we read at most `sampleRows`
	 * rows (a LIMITed scan, never a full scan), cap the distinct sample values,
	 * and run under a short statement timeout. Best-effort: any failure leaves
	 * that column's stats unset rather than aborting introspection.
	 */
	private async collectColumnStats(
		tables: IntrospectedTable[],
		opts: IntrospectionOptions,
	): Promise<void> {
		for (const table of tables) {
			// Cost guard: skip stats on tables estimated above the threshold.
			if (
				table.rowCountEstimate != null &&
				table.rowCountEstimate > opts.statsMaxTableRows
			) {
				continue;
			}
			for (const column of table.columns) {
				if (column.normalizedType !== "string") {
					continue;
				}
				try {
					const stats = await this.fetchColumnStats(table, column, opts);
					column.distinctCount = stats.distinctCount;
					column.sampleValues = stats.sampleValues;
				} catch (error) {
					logger.debug(
						{
							error: getErrorMessage(error),
							table: table.name,
							column: column.name,
						},
						"AskBI stats collection skipped for column",
					);
				}
			}
		}
	}

	private async fetchColumnStats(
		table: IntrospectedTable,
		column: IntrospectedColumn,
		opts: IntrospectionOptions,
	): Promise<{ distinctCount?: number; sampleValues?: string[] }> {
		const relation = `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
		const col = quoteIdent(column.name);
		const sampleRows = Math.max(1, Math.floor(opts.sampleRows));
		const maxSamples = Math.max(1, Math.floor(opts.maxSampleValues));
		// Integers are interpolated (they are server-controlled, not user input);
		// identifiers are quoted. The window LIMIT bounds the scan cost.
		const statsSql = `
			WITH sample AS (
				SELECT ${col} AS v
				FROM ${relation}
				WHERE ${col} IS NOT NULL
				LIMIT ${sampleRows}
			)
			SELECT count(DISTINCT v) AS distinct_count,
			       (array_agg(DISTINCT left(v::text, 100)))[1:${maxSamples}] AS samples
			FROM sample`;

		const res = await this.inReadOnlyTx(opts.statsTimeoutMs, (client) =>
			client.query<StatsRow>(statsSql),
		);
		const row = res.rows[0];
		return {
			distinctCount:
				row?.distinct_count == null ? undefined : Number(row.distinct_count),
			sampleValues: row?.samples ?? undefined,
		};
	}

	/**
	 * Run `fn` inside a `BEGIN READ ONLY` transaction with a `SET LOCAL`
	 * statement timeout, committing on success and rolling back on error. The
	 * client is always released back to the pool.
	 */
	private async inReadOnlyTx<T>(
		timeoutMs: number,
		fn: (client: PoolClient) => Promise<T>,
	): Promise<T> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN READ ONLY");
			await client.query(
				`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(timeoutMs))}`,
			);
			const out = await fn(client);
			await client.query("COMMIT");
			return out;
		} catch (error) {
			await client.query("ROLLBACK").catch(() => {});
			throw error;
		} finally {
			client.release();
		}
	}
}
