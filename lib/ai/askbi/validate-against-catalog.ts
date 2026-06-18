import { Parser } from "node-sql-parser";
import type { SqlDialect } from "@/lib/datasources/types";
import type { FieldRole } from "./viz/spec";

/**
 * Catalog-grounded SQL analysis: the anti-hallucination layer plus the
 * structure-derived column roles that drive deterministic chart selection.
 *
 * Both come from one parse so the work is shared. `validateAgainstCatalog`
 * runs inside `execute.ts` (alongside the SELECT-only AST check) BEFORE the
 * connector — so a model that invents a table/column is rejected even if it
 * skipped the agent's validate step. `outputRoles` feeds `chooseViz` as the
 * AUTHORITATIVE role signal: a GROUP BY key is a dimension and an aggregate is
 * a measure regardless of data type, which is what keeps a numeric `month`/
 * `year`/`*_id` from being mis-read as a measure.
 *
 * Existence checks lean on node-sql-parser's `tableList`/`columnList` (which
 * resolve aliases to real tables); the AST is used for CTE names, output
 * aliases, and roles. Policy: strict-reject unknown tables and determinable
 * unknown columns; skip checks that are genuinely ambiguous (CTE-qualified
 * columns, output aliases) — the read-only role + execution error + repair
 * loop are the backstop for that residual.
 *
 * Pure (no DB / env / LLM), unit-testable in isolation.
 */

const parser = new Parser();

const AGGREGATE_FUNCTIONS = new Set([
	"sum",
	"count",
	"avg",
	"min",
	"max",
	"total",
	"array_agg",
	"string_agg",
	"bool_and",
	"bool_or",
	"stddev",
	"variance",
	"var_pop",
	"var_samp",
	"stddev_pop",
	"stddev_samp",
	"corr",
	"covar_pop",
	"covar_samp",
]);

// Functions whose output is a time bucket/axis.
const TIME_FUNCTIONS = new Set(["date_trunc"]);

export interface CatalogTableInput {
	schema: string;
	table: string;
	columns: string[];
}
export interface ValidationCatalog {
	tables: CatalogTableInput[];
}

export interface RealTableRef {
	schema: string | null;
	table: string;
}
export interface ColumnRefEntry {
	table: string | null;
	column: string;
}

export interface SqlAnalysis {
	ok: boolean;
	parseError?: string;
	realTables: RealTableRef[];
	columnRefs: ColumnRefEntry[];
	cteNames: Set<string>;
	outputAliases: Set<string>;
	/** Output column name (lowercased) → authoritative role, where derivable. */
	outputRoles: Record<string, FieldRole>;
	hasGroupBy: boolean;
}

export interface CatalogValidationResult {
	ok: boolean;
	reason?: string;
	unknownTables?: string[];
	unknownColumns?: string[];
}

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

type AstNode = Record<string, unknown>;

function isNode(v: unknown): v is AstNode {
	return !!v && typeof v === "object";
}

function walk(node: unknown, visit: (n: AstNode) => void): void {
	if (Array.isArray(node)) {
		for (const item of node) walk(item, visit);
		return;
	}
	if (isNode(node)) {
		visit(node);
		for (const key of Object.keys(node)) walk(node[key], visit);
	}
}

/** Extract a column name from a node-sql-parser `column` field. */
function columnName(column: unknown): string | null {
	if (typeof column === "string") return column;
	if (isNode(column)) {
		const expr = column.expr;
		if (isNode(expr) && typeof expr.value === "string") return expr.value;
		if (typeof column.value === "string") return column.value;
	}
	return null;
}

/** Extract a (possibly schema-qualified) function name, lowercased. */
function functionName(name: unknown): string | null {
	if (typeof name === "string") return name.toLowerCase();
	if (isNode(name)) {
		const inner = name.name;
		if (Array.isArray(inner)) {
			const last = inner[inner.length - 1];
			if (isNode(last) && typeof last.value === "string") {
				return last.value.toLowerCase();
			}
		}
	}
	return null;
}

function containsAggregate(node: unknown): boolean {
	let found = false;
	walk(node, (n) => {
		if (n.type === "aggr_func") found = true;
	});
	return found;
}

function roleOfExpr(expr: AstNode, hasGroupBy: boolean): FieldRole | null {
	const type = expr.type;
	if (type === "aggr_func") return "measure";
	if (type === "function") {
		const fn = functionName(expr.name);
		if (fn && TIME_FUNCTIONS.has(fn)) return "time";
		if (fn && AGGREGATE_FUNCTIONS.has(fn)) return "measure";
		return null;
	}
	if (type === "column_ref") {
		// A bare column that survives a GROUP BY is a grouping key → dimension,
		// regardless of its data type (this is the year/month-as-int fix).
		return hasGroupBy ? "dimension" : null;
	}
	if (type === "binary_expr" || type === "function" || type === "case") {
		return containsAggregate(expr) ? "measure" : null;
	}
	return null;
}

function collectCteNames(ast: unknown): Set<string> {
	const names = new Set<string>();
	walk(ast, (n) => {
		// A CTE definition node has both a `name` and a `stmt`.
		if (n.stmt && isNode(n.name) && typeof n.name.value === "string") {
			names.add(n.name.value.toLowerCase());
		}
	});
	return names;
}

function collectOutputAliases(ast: unknown): Set<string> {
	const aliases = new Set<string>();
	walk(ast, (n) => {
		// A select-list item has an `expr` and an `as` alias.
		if ("expr" in n && typeof n.as === "string" && n.as.length > 0) {
			aliases.add(n.as.toLowerCase());
		}
	});
	return aliases;
}

function extractRoles(ast: AstNode): {
	outputRoles: Record<string, FieldRole>;
	hasGroupBy: boolean;
} {
	const groupby = ast.groupby;
	const hasGroupBy =
		(Array.isArray(groupby) && groupby.length > 0) ||
		(isNode(groupby) &&
			Array.isArray(groupby.columns) &&
			groupby.columns.length > 0);

	const roles: Record<string, FieldRole> = {};
	const columns = ast.columns;
	if (Array.isArray(columns)) {
		for (const col of columns) {
			if (!isNode(col)) continue;
			const expr = col.expr;
			if (!isNode(expr)) continue;
			const alias = typeof col.as === "string" ? col.as : null;
			const name =
				alias ?? (expr.type === "column_ref" ? columnName(expr.column) : null);
			if (!name) continue;
			const role = roleOfExpr(expr, hasGroupBy);
			if (role) roles[name.toLowerCase()] = role;
		}
	}
	return { outputRoles: roles, hasGroupBy };
}

function parseListEntry(entry: string): string[] {
	return entry.split("::");
}

export function analyzeSql(sql: string, dialect: SqlDialect): SqlAnalysis {
	const database = toParserDatabase(dialect);
	let ast: AstNode;
	let tableListRaw: string[];
	let columnListRaw: string[];
	try {
		const parsed = parser.astify(sql, { database });
		const first = Array.isArray(parsed) ? parsed[0] : parsed;
		ast = isNode(first) ? first : {};
		tableListRaw = parser.tableList(sql, { database });
		columnListRaw = parser.columnList(sql, { database });
	} catch (error) {
		return {
			ok: false,
			parseError: error instanceof Error ? error.message : "parse error",
			realTables: [],
			columnRefs: [],
			cteNames: new Set(),
			outputAliases: new Set(),
			outputRoles: {},
			hasGroupBy: false,
		};
	}

	const cteNames = collectCteNames(ast);
	const outputAliases = collectOutputAliases(ast);

	const realTables: RealTableRef[] = [];
	for (const entry of tableListRaw) {
		const [, db, table] = parseListEntry(entry);
		if (!table) continue;
		if (cteNames.has(table.toLowerCase())) continue; // CTE, not a catalog table
		realTables.push({ schema: db && db !== "null" ? db : null, table });
	}

	const columnRefs: ColumnRefEntry[] = [];
	for (const entry of columnListRaw) {
		const [, table, column] = parseListEntry(entry);
		if (!column || column === "(.*)" || column === "*") continue;
		columnRefs.push({
			table: table && table !== "null" ? table : null,
			column,
		});
	}

	const { outputRoles, hasGroupBy } = extractRoles(ast);

	return {
		ok: true,
		realTables,
		columnRefs,
		cteNames,
		outputAliases,
		outputRoles,
		hasGroupBy,
	};
}

export function validateAgainstCatalog(
	analysis: SqlAnalysis,
	catalog: ValidationCatalog,
): CatalogValidationResult {
	if (!analysis.ok) {
		return { ok: false, reason: "Could not parse SQL for catalog validation" };
	}

	// Catalog lookups, all lowercased.
	const bySchemaTable = new Map<string, Set<string>>();
	const byTable = new Map<string, Set<string>[]>();
	for (const t of catalog.tables) {
		const cols = new Set(t.columns.map((c) => c.toLowerCase()));
		const tl = t.table.toLowerCase();
		bySchemaTable.set(`${t.schema.toLowerCase()}.${tl}`, cols);
		const list = byTable.get(tl) ?? [];
		list.push(cols);
		byTable.set(tl, list);
	}

	const unknownTables: string[] = [];
	const columnUniverse = new Set<string>();

	for (const ref of analysis.realTables) {
		const tl = ref.table.toLowerCase();
		let cols: Set<string> | undefined;
		if (ref.schema) {
			cols = bySchemaTable.get(`${ref.schema.toLowerCase()}.${tl}`);
		} else {
			const matches = byTable.get(tl);
			if (matches && matches.length > 0) {
				cols = new Set(matches.flatMap((s) => [...s]));
			}
		}
		if (!cols) {
			unknownTables.push(ref.schema ? `${ref.schema}.${ref.table}` : ref.table);
			continue;
		}
		for (const c of cols) columnUniverse.add(c);
	}

	const unknownColumns: string[] = [];
	for (const ref of analysis.columnRefs) {
		const col = ref.column.toLowerCase();
		if (ref.table) {
			const tt = ref.table.toLowerCase();
			if (analysis.cteNames.has(tt)) continue; // CTE-qualified — can't verify
			const matches = byTable.get(tt);
			if (!matches || matches.length === 0) continue; // alias to derived/unknown — skip
			if (!matches.some((s) => s.has(col))) {
				unknownColumns.push(`${ref.table}.${ref.column}`);
			}
		} else {
			if (analysis.outputAliases.has(col)) continue; // an output alias, not a base column
			if (!columnUniverse.has(col)) unknownColumns.push(ref.column);
		}
	}

	if (unknownTables.length > 0 || unknownColumns.length > 0) {
		const parts: string[] = [];
		if (unknownTables.length > 0) {
			parts.push(`unknown table(s): ${unknownTables.join(", ")}`);
		}
		if (unknownColumns.length > 0) {
			parts.push(`unknown column(s): ${unknownColumns.join(", ")}`);
		}
		return {
			ok: false,
			reason: `Query references schema not in the catalog — ${parts.join("; ")}`,
			...(unknownTables.length > 0 ? { unknownTables } : {}),
			...(unknownColumns.length > 0 ? { unknownColumns } : {}),
		};
	}

	return { ok: true };
}

/** Convenience: analyze + validate in one call (used by tests). */
export function validateSqlAgainstCatalog(
	sql: string,
	catalog: ValidationCatalog,
	dialect: SqlDialect = "postgresql",
): CatalogValidationResult {
	return validateAgainstCatalog(analyzeSql(sql, dialect), catalog);
}
