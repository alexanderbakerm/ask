import { Parser } from "node-sql-parser";
import type { SqlDialect } from "@/lib/datasources/types";

/**
 * SELECT-only SQL validation via AST parsing.
 *
 * This is the application-layer half of a defense-in-depth model: every data
 * source is also connected with a read-only database role, but we never rely on
 * that alone. Here we parse the statement and reject anything that is not a
 * single, pure read:
 *
 * - non-SELECT statements (INSERT/UPDATE/DELETE/DDL/etc.),
 * - multiple / stacked statements (`SELECT 1; DROP TABLE t`),
 * - data-modifying statements smuggled inside CTEs
 *   (`WITH x AS (DELETE ... RETURNING *) SELECT * FROM x`),
 * - calls to known dangerous functions (file/network/process access, sleeps).
 *
 * Unparseable input is rejected (fail closed): if we cannot understand a
 * statement, we will not run it.
 */

export interface SqlValidationResult {
	ok: boolean;
	/** Human-readable rejection reason, suitable for an audit log / UI. */
	reason?: string;
	/** Detected top-level statement type when parsing succeeded. */
	statementType?: string;
}

/** Statement-level node types that must never appear anywhere in the AST. */
const FORBIDDEN_STATEMENT_TYPES = new Set<string>([
	"insert",
	"update",
	"delete",
	"replace",
	"merge",
	"create",
	"drop",
	"alter",
	"truncate",
	"rename",
	"grant",
	"revoke",
	"call",
	"exec",
	"execute",
	"set",
	"use",
	"load",
	"lock",
	"unlock",
	"copy",
	"prepare",
	"deallocate",
	"declare",
	"do",
	"vacuum",
	"analyze",
	"reindex",
	"cluster",
	"comment",
	"begin",
	"start",
	"commit",
	"rollback",
	"savepoint",
	"release",
	"show",
	// NOTE: "desc" is deliberately NOT listed. node-sql-parser tags the ORDER BY
	// direction node with type "DESC", so forbidding it here rejects every
	// `ORDER BY x DESC`. A real DESCRIBE statement is still blocked by the
	// top-level select-only check (its top type is never "select").
	"describe",
	"explain",
	"attach",
	"detach",
]);

/**
 * Functions that can read files, reach the network, run commands, or stall a
 * connection. A pure SELECT can still call these, so the read-only grant must
 * be the primary defense — but we block the well-known ones here too.
 */
const DANGEROUS_FUNCTIONS = new Set<string>([
	// PostgreSQL filesystem / admin
	"pg_read_file",
	"pg_read_binary_file",
	"pg_ls_dir",
	"pg_stat_file",
	"pg_read_server_files",
	"pg_sleep",
	"pg_sleep_for",
	"pg_sleep_until",
	"pg_terminate_backend",
	"pg_cancel_backend",
	"pg_reload_conf",
	"pg_rotate_logfile",
	"set_config",
	// large objects
	"lo_import",
	"lo_export",
	"lo_get",
	"lo_put",
	// dblink / foreign access
	"dblink",
	"dblink_exec",
	"dblink_connect",
	// MySQL
	"load_file",
	"sleep",
	"benchmark",
	// SQL Server
	"xp_cmdshell",
	"openrowset",
	"opendatasource",
]);

const parser = new Parser();

function getType(node: Record<string, unknown>): string | undefined {
	const t = node.type;
	return typeof t === "string" ? t.toLowerCase() : undefined;
}

/** Depth-first visit of every object node in an AST. */
function walk(
	node: unknown,
	visit: (n: Record<string, unknown>) => void,
): void {
	if (Array.isArray(node)) {
		for (const item of node) {
			walk(item, visit);
		}
		return;
	}
	if (node && typeof node === "object") {
		const obj = node as Record<string, unknown>;
		visit(obj);
		for (const key of Object.keys(obj)) {
			walk(obj[key], visit);
		}
	}
}

/** Collect every string contained in a (possibly nested) value. */
function collectStrings(node: unknown, out: string[]): void {
	if (typeof node === "string") {
		out.push(node);
		return;
	}
	if (Array.isArray(node)) {
		for (const item of node) {
			collectStrings(item, out);
		}
		return;
	}
	if (node && typeof node === "object") {
		for (const value of Object.values(node as Record<string, unknown>)) {
			collectStrings(value, out);
		}
	}
}

/** node-sql-parser uses its own casing for the `database` option. */
function toParserDatabase(dialect: SqlDialect): string {
	switch (dialect) {
		case "mysql":
			return "MySQL";
		case "snowflake":
			return "Snowflake";
		default:
			return "PostgreSQL";
	}
}

export function validateReadOnlySql(
	sql: string,
	dialect: SqlDialect = "postgresql",
): SqlValidationResult {
	const trimmed = sql.trim();
	if (!trimmed) {
		return { ok: false, reason: "Empty SQL statement" };
	}

	let ast: unknown;
	try {
		ast = parser.astify(trimmed, { database: toParserDatabase(dialect) });
	} catch (error) {
		const message = error instanceof Error ? error.message : "parse error";
		return { ok: false, reason: `Could not parse SQL: ${message}` };
	}

	const statements = Array.isArray(ast) ? ast : [ast];

	if (statements.length === 0) {
		return { ok: false, reason: "No statement found" };
	}
	if (statements.length > 1) {
		return {
			ok: false,
			reason: "Multiple statements are not allowed (only a single SELECT)",
		};
	}

	const top = statements[0];
	const topType =
		top && typeof top === "object"
			? getType(top as Record<string, unknown>)
			: undefined;

	if (topType !== "select") {
		return {
			ok: false,
			reason: `Only SELECT statements are allowed (got "${topType ?? "unknown"}")`,
			statementType: topType,
		};
	}

	let rejection: string | undefined;

	walk(ast, (node) => {
		if (rejection) {
			return;
		}
		const type = getType(node);
		if (type && FORBIDDEN_STATEMENT_TYPES.has(type)) {
			rejection = `Disallowed statement detected: "${type}"`;
			return;
		}
		if (type === "function" || type === "aggr_func") {
			const names: string[] = [];
			collectStrings(node.name, names);
			for (const name of names) {
				if (DANGEROUS_FUNCTIONS.has(name.toLowerCase())) {
					rejection = `Disallowed function: "${name}"`;
					return;
				}
			}
		}
	});

	if (rejection) {
		return { ok: false, reason: rejection, statementType: topType };
	}

	return { ok: true, statementType: topType };
}
