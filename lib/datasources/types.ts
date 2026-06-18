import type { ColumnKind, DataSourceType } from "@/lib/db/schema/enums";

/**
 * The SQL dialect a source speaks. Values intentionally match the `database`
 * option accepted by `node-sql-parser` so the validator can be driven directly
 * from a source's dialect. Phase 1 ships PostgreSQL only.
 */
export type SqlDialect = "postgresql" | "mysql" | "snowflake";

/**
 * Non-secret connection details, safe to persist in plaintext and to show in
 * the UI. The password / secret is stored separately, encrypted at rest, and
 * is never part of this object.
 */
export interface PostgresConnectionConfig {
	type: Extract<DataSourceType, "postgres">;
	host: string;
	port: number;
	database: string;
	user: string;
	/** Whether to require TLS. Most managed Postgres requires this. */
	ssl: boolean;
}

/** Discriminated union of non-secret connection configs (extends per source). */
export type ConnectionConfig = PostgresConnectionConfig;

/** The secret half of a connection, encrypted at rest, server-only. */
export interface ConnectionSecrets {
	password: string;
}

// ---------------------------------------------------------------------------
// Introspection / catalog
// ---------------------------------------------------------------------------

export interface IntrospectedColumn {
	name: string;
	/** Raw engine type, e.g. "integer", "character varying", "timestamptz". */
	dataType: string;
	/** Normalized kind used by downstream chart-selection logic. */
	normalizedType: ColumnKind;
	isNullable: boolean;
	isPrimaryKey: boolean;
	ordinalPosition: number;
	/** Distinct value count for low-cardinality columns (cheap stat, optional). */
	distinctCount?: number;
	/** A few sample values for low-cardinality columns (optional). */
	sampleValues?: string[];
}

export interface ForeignKeyRef {
	column: string;
	referencesSchema: string;
	referencesTable: string;
	referencesColumn: string;
}

export interface IntrospectedTable {
	schema: string;
	name: string;
	rowCountEstimate?: number;
	columns: IntrospectedColumn[];
	foreignKeys: ForeignKeyRef[];
}

export interface Catalog {
	dialect: SqlDialect;
	tables: IntrospectedTable[];
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

export interface QueryColumn {
	name: string;
	/** Engine type id/name when available from result metadata. */
	dataType?: string;
}

export interface QueryResult {
	columns: QueryColumn[];
	rows: Record<string, unknown>[];
	rowCount: number;
	/** True when results were capped by `maxRows` (more rows existed). */
	truncated: boolean;
	durationMs: number;
}

export interface RunQueryOptions {
	/** Hard cap on returned rows; also enforced by an injected LIMIT. */
	maxRows: number;
	/** Server-side statement timeout in milliseconds. */
	timeoutMs: number;
}

export interface TestConnectionResult {
	ok: boolean;
	error?: string;
	latencyMs?: number;
	serverVersion?: string;
}

/**
 * Source-agnostic connector contract. The query agent depends only on this
 * interface, never on a concrete engine, so adding Snowflake/MySQL/file
 * sources later does not touch agent code.
 *
 * Implementations are server-only and must:
 * - connect with read-only credentials,
 * - enforce `maxRows` + `timeoutMs` on every `runQuery`,
 * - never accept or execute non-SELECT input (validated upstream by the AST
 *   checker; defense-in-depth alongside the database's read-only grant).
 */
export interface DataSourceConnector {
	readonly dialect: SqlDialect;
	testConnection(): Promise<TestConnectionResult>;
	introspect(): Promise<Catalog>;
	runQuery(sql: string, opts: RunQueryOptions): Promise<QueryResult>;
	/** Release any pooled resources. */
	close(): Promise<void>;
}

/** Sensible default execution guards; callers may tighten further. */
export const DEFAULT_QUERY_LIMITS: RunQueryOptions = {
	maxRows: 1000,
	timeoutMs: 15_000,
};
