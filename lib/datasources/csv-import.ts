import Papa from "papaparse";
import type { ColumnKind } from "@/lib/db/schema/enums";

/**
 * Pure CSV → table-shape logic for the "Import CSV" data source.
 *
 * Parses CSV text, infers a Postgres-friendly type per column from the data,
 * and derives SAFE identifiers + a CREATE TABLE statement. No DB, no env, no
 * secrets — unit-tested in isolation. The loader (csv-loader.ts) takes this
 * shape and writes it to Postgres; everything downstream (catalog, chooseViz,
 * the chokepoint) then treats it like any other Postgres source.
 *
 * Identifier safety: every emitted name matches `^[a-z_][a-z0-9_]*$` and is
 * quoted at use, so a malicious header can never break out into SQL.
 */

export interface CsvColumn {
	/** Safe, unique, snake_cased SQL identifier. */
	name: string;
	/** Original header text (shown in the UI). */
	label: string;
	kind: ColumnKind;
	/** Concrete Postgres column type for the CREATE TABLE. */
	pgType: string;
}

export interface ParsedCsv {
	columns: CsvColumn[];
	/** Data rows (excludes the header row), each aligned to `columns`. */
	rows: string[][];
}

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const NUMERIC_RE = /^-?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i;
const BOOL_TRUE = new Set(["true", "t", "yes", "y"]);
const BOOL_FALSE = new Set(["false", "f", "no", "n"]);

/** Snake-case a header into a safe SQL identifier (quoted at use anyway). */
export function normalizeIdentifier(raw: string, fallback: string): string {
	let id = raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");
	if (id && /^[0-9]/.test(id)) id = `c_${id}`;
	if (!id) id = fallback;
	id = id.slice(0, 63);
	return IDENT_RE.test(id) ? id : fallback;
}

/** Ensure column names are unique (append _2, _3, … on collision). */
function dedupe(names: string[]): string[] {
	const seen = new Map<string, number>();
	return names.map((n) => {
		const count = seen.get(n) ?? 0;
		seen.set(n, count + 1);
		if (count === 0) return n;
		return `${n}_${count + 1}`.slice(0, 63);
	});
}

const isBlank = (v: string): boolean => v == null || v.trim() === "";

/**
 * Infer a column's kind from its non-empty values. Conservative: every value
 * must match for a narrow kind, otherwise it falls back to string (so the
 * load never hits a Postgres type error on an outlier row).
 */
export function inferColumnKind(values: string[]): ColumnKind {
	const present = values.map((v) => (v ?? "").trim()).filter((v) => v !== "");
	if (present.length === 0) return "string";
	const every = (re: RegExp) => present.every((v) => re.test(v));
	if (present.every((v) => BOOL_TRUE.has(v.toLowerCase()) || BOOL_FALSE.has(v.toLowerCase()))) {
		return "boolean";
	}
	if (every(NUMERIC_RE)) return "number";
	if (every(ISO_DATETIME_RE)) return "datetime";
	if (every(ISO_DATE_RE)) return "date";
	return "string";
}

export function pgTypeForKind(kind: ColumnKind): string {
	switch (kind) {
		case "number":
			return "numeric";
		case "boolean":
			return "boolean";
		case "date":
			return "date";
		case "datetime":
			return "timestamptz";
		default:
			return "text";
	}
}

/**
 * Coerce a raw CSV cell to a value safe to bind for its inferred kind. Anything
 * that doesn't cleanly fit becomes NULL rather than risking a load failure.
 */
export function coerceValue(raw: string, kind: ColumnKind): unknown {
	if (isBlank(raw)) return null;
	const v = raw.trim();
	switch (kind) {
		case "number": {
			const n = Number(v);
			return Number.isFinite(n) ? n : null;
		}
		case "boolean": {
			const lc = v.toLowerCase();
			if (BOOL_TRUE.has(lc)) return true;
			if (BOOL_FALSE.has(lc)) return false;
			return null;
		}
		case "date":
			return ISO_DATE_RE.test(v) ? v : null;
		case "datetime":
			return ISO_DATETIME_RE.test(v) ? v : null;
		default:
			return v;
	}
}

const SAMPLE_ROWS = 200;

/**
 * Parse CSV text into a typed column shape + data rows. `hasHeader` controls
 * whether the first row names the columns (otherwise `column_1`, …).
 */
export function parseCsv(text: string, hasHeader = true): ParsedCsv {
	const result = Papa.parse<string[]>(text, {
		skipEmptyLines: "greedy",
	});
	const data = (result.data as unknown[][]).map((r) =>
		r.map((c) => (c == null ? "" : String(c))),
	);
	if (data.length === 0) {
		return { columns: [], rows: [] };
	}
	const headerRow = hasHeader ? data[0] : undefined;
	// With a header, the header defines the column count (extra cells in data
	// rows are trailing-comma noise → truncated); otherwise take the widest row.
	const width = headerRow
		? headerRow.length
		: Math.max(...data.map((r) => r.length));
	const rows = (hasHeader ? data.slice(1) : data).map((r) => {
		const padded = r.slice(0, width);
		while (padded.length < width) padded.push("");
		return padded;
	});

	const rawNames = Array.from({ length: width }, (_, i) =>
		normalizeIdentifier(headerRow?.[i] ?? "", `column_${i + 1}`),
	);
	const names = dedupe(rawNames);

	const columns: CsvColumn[] = names.map((name, i) => {
		const sample = rows.slice(0, SAMPLE_ROWS).map((r) => r[i] ?? "");
		const kind = inferColumnKind(sample);
		return {
			name,
			label: (headerRow?.[i] ?? `Column ${i + 1}`).trim() || `Column ${i + 1}`,
			kind,
			pgType: pgTypeForKind(kind),
		};
	});

	return { columns, rows };
}

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;

/** CREATE TABLE DDL for a parsed CSV. Identifiers are pre-sanitized + quoted. */
export function buildCreateTableSql(
	schema: string,
	table: string,
	columns: CsvColumn[],
): string {
	const cols = columns.map((c) => `${q(c.name)} ${c.pgType}`).join(", ");
	return `CREATE TABLE ${q(schema)}.${q(table)} (${cols})`;
}
