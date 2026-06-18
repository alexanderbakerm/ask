import type { ColumnKind } from "@/lib/db/schema/enums";

/**
 * Map a PostgreSQL type (as reported by `information_schema.columns.data_type`,
 * e.g. "integer", "character varying", "timestamp with time zone") to the
 * normalized {@link ColumnKind} used by downstream chart-selection logic.
 *
 * Pure (no DB / env), unit-testable in isolation.
 */
export function normalizePgType(dataType: string): ColumnKind {
	const t = dataType.trim().toLowerCase();

	if (t === "boolean" || t === "bool") {
		return "boolean";
	}
	if (t === "date") {
		return "date";
	}
	// Order matters: "timestamp..." must be checked before "time...".
	if (t.startsWith("timestamp")) {
		return "datetime";
	}
	if (t.startsWith("time")) {
		return "time";
	}
	if (t.includes("json")) {
		return "json";
	}

	const numberTypes = new Set([
		"smallint",
		"integer",
		"int",
		"int2",
		"int4",
		"int8",
		"bigint",
		"decimal",
		"numeric",
		"real",
		"double precision",
		"float",
		"float4",
		"float8",
		"money",
		"serial",
		"bigserial",
		"smallserial",
	]);
	if (
		numberTypes.has(t) ||
		t.startsWith("numeric") ||
		t.startsWith("decimal")
	) {
		return "number";
	}

	const stringTypes = new Set([
		"character varying",
		"varchar",
		"character",
		"char",
		"bpchar",
		"text",
		"uuid",
		"name",
		"citext",
		"inet",
		"cidr",
		"macaddr",
		"xml",
		// Enums and other custom types report as USER-DEFINED; treat as categorical.
		"user-defined",
		"array",
	]);
	if (
		stringTypes.has(t) ||
		t.startsWith("character") ||
		t.startsWith("varchar")
	) {
		return "string";
	}

	return "unknown";
}
