import type { ColumnKind } from "@/lib/db/schema/enums";

/**
 * Catalog retrieval — the grounding lever.
 *
 * Grounding errors are asymmetric: over-retrieving (a couple of extra tables
 * the model ignores) is nearly free because the validators are strict and the
 * repair loop exists, but UNDER-retrieving causes a *false* grounding miss — an
 * honest "couldn't find data" when the data was right there. For a tool whose
 * whole job is finding data, that's the worst non-wrong failure. So we bias
 * hard toward recall:
 *
 * - rank, then take a generous top-N (context budget is the only real limit);
 * - **pull in FK-connected neighbors** (bidirectionally, one hop by default) so
 *   the bridge/dimension tables a join needs are present even when only the
 *   fact table matched lexically — the single biggest driver of multi-table
 *   correctness;
 * - weight fields deliberately: table/column NAMES highest, then
 *   descriptions/synonyms, then sample VALUES (lower — their job is entity/
 *   filter resolution: "product X" → which column holds 'X');
 * - keep the grounding-miss floor low: a miss means even the generous ranker
 *   found essentially nothing.
 *
 * Pure (no DB / env), unit-tested in isolation. The DB loader that builds a
 * `SourceCatalog` lives with the agent tool.
 */

// ---- Catalog shapes (decoupled from the DB rows) ----
export interface CatalogColumn {
	name: string;
	dataType: string;
	normalizedType: ColumnKind;
	isNullable: boolean;
	isPrimaryKey: boolean;
	description?: string | null;
	synonyms?: string[];
	distinctCount?: number | null;
	sampleValues?: string[];
}
export interface CatalogForeignKey {
	column: string;
	referencesSchema: string;
	referencesTable: string;
	referencesColumn: string;
}
export interface CatalogTable {
	schema: string;
	name: string;
	description?: string | null;
	synonyms?: string[];
	rowCountEstimate?: number | null;
	columns: CatalogColumn[];
	foreignKeys: CatalogForeignKey[];
}
export interface SourceCatalog {
	tables: CatalogTable[];
}

// ---- Retrieved slice ----
export interface RetrievedColumn {
	name: string;
	dataType: string;
	normalizedType: ColumnKind;
	isNullable: boolean;
	isPrimaryKey: boolean;
	description?: string | null;
	sampleValues?: string[];
}
export interface RetrievedTable {
	schema: string;
	name: string;
	description?: string | null;
	rowCountEstimate?: number | null;
	columns: RetrievedColumn[];
	foreignKeys: CatalogForeignKey[];
	score: number;
	reason: "matched" | "fk-neighbor";
}
export interface RetrievedCatalog {
	tables: RetrievedTable[];
	/** Tables that scored above the floor via lexical/value match (drives the
	 * grounding-miss decision — FK-neighbors don't count). */
	matchedTableCount: number;
}

export interface RetrieveOptions {
	maxMatchedTables?: number;
	fkHops?: number;
	maxSampleValues?: number;
	lowCardinalityMax?: number;
	minScore?: number;
	maxSliceTables?: number;
}

const DEFAULTS = {
	maxMatchedTables: 12,
	fkHops: 1,
	maxSampleValues: 8,
	lowCardinalityMax: 50,
	minScore: 1, // low floor — recall bias
	maxSliceTables: 25,
};

// Field weights: names dominate, then descriptions/synonyms, then sample values.
const W_TABLE_NAME = 10;
const W_COLUMN_NAME = 6;
const W_TABLE_DESC = 4;
const W_COLUMN_DESC = 3;
const W_SAMPLE_VALUE = 2;

const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"of",
	"for",
	"by",
	"in",
	"on",
	"to",
	"and",
	"or",
	"with",
	"per",
	"show",
	"me",
	"what",
	"which",
	"how",
	"many",
	"much",
	"is",
	"are",
	"was",
	"were",
	"do",
	"does",
	"give",
	"list",
	"count",
	"total",
	"over",
	"this",
	"that",
	"all",
	"from",
	"between",
	"vs",
	"versus",
]);

function tokenize(input: string): string[] {
	return (
		input
			.replace(/[_-]+/g, " ")
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.toLowerCase()
			.match(/[a-z0-9]+/g) ?? []
	);
}

/** Gentle plural folding (products→product, sales→sale); not a full stemmer. */
function normalize(token: string): string {
	return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

function tokenSet(...parts: (string | null | undefined)[]): Set<string> {
	const set = new Set<string>();
	for (const part of parts) {
		if (!part) continue;
		for (const t of tokenize(part)) set.add(normalize(t));
	}
	return set;
}

function overlap(queryTokens: Set<string>, fieldTokens: Set<string>): number {
	let n = 0;
	for (const t of queryTokens) if (fieldTokens.has(t)) n += 1;
	return n;
}

function tableKey(schema: string, name: string): string {
	return `${schema.toLowerCase()}.${name.toLowerCase()}`;
}

function scoreTable(table: CatalogTable, queryTokens: Set<string>): number {
	let score = 0;
	score += W_TABLE_NAME * overlap(queryTokens, tokenSet(table.name));
	score +=
		W_TABLE_DESC *
		overlap(
			queryTokens,
			tokenSet(table.description, ...(table.synonyms ?? [])),
		);

	for (const col of table.columns) {
		score += W_COLUMN_NAME * overlap(queryTokens, tokenSet(col.name));
		score +=
			W_COLUMN_DESC *
			overlap(queryTokens, tokenSet(col.description, ...(col.synonyms ?? [])));
		// Sample values: count once per column (entity/filter resolution), bounded.
		if (col.sampleValues?.length) {
			const sampleTokens = tokenSet(...col.sampleValues);
			if (overlap(queryTokens, sampleTokens) > 0) score += W_SAMPLE_VALUE;
		}
	}
	return score;
}

function buildAdjacency(tables: CatalogTable[]): Map<string, Set<string>> {
	const adj = new Map<string, Set<string>>();
	const ensure = (k: string): Set<string> => {
		let s = adj.get(k);
		if (!s) {
			s = new Set();
			adj.set(k, s);
		}
		return s;
	};
	for (const t of tables) {
		const k = tableKey(t.schema, t.name);
		ensure(k);
		for (const fk of t.foreignKeys) {
			const ref = tableKey(fk.referencesSchema, fk.referencesTable);
			ensure(k).add(ref); // outgoing: this table references ref
			ensure(ref).add(k); // incoming: ref is referenced by this table
		}
	}
	return adj;
}

function projectColumn(
	col: CatalogColumn,
	opts: typeof DEFAULTS,
): RetrievedColumn {
	const includeSamples =
		!!col.sampleValues?.length &&
		(col.distinctCount == null || col.distinctCount <= opts.lowCardinalityMax);
	return {
		name: col.name,
		dataType: col.dataType,
		normalizedType: col.normalizedType,
		isNullable: col.isNullable,
		isPrimaryKey: col.isPrimaryKey,
		description: col.description ?? null,
		...(includeSamples
			? { sampleValues: col.sampleValues?.slice(0, opts.maxSampleValues) }
			: {}),
	};
}

export function rankCatalog(
	catalog: SourceCatalog,
	question: string,
	options: RetrieveOptions = {},
): RetrievedCatalog {
	const opts = { ...DEFAULTS, ...options };
	const queryTokens = new Set(
		tokenize(question)
			.map(normalize)
			.filter((t) => t.length > 1 && !STOPWORDS.has(t)),
	);

	const byKey = new Map<string, CatalogTable>();
	for (const t of catalog.tables) byKey.set(tableKey(t.schema, t.name), t);

	// Score + collect matches above the (low) floor.
	const scores = new Map<string, number>();
	for (const t of catalog.tables) {
		scores.set(tableKey(t.schema, t.name), scoreTable(t, queryTokens));
	}
	const matched = catalog.tables
		.map((t) => ({
			key: tableKey(t.schema, t.name),
			score: scores.get(tableKey(t.schema, t.name)) ?? 0,
		}))
		.filter((m) => m.score >= opts.minScore)
		.sort((a, b) => b.score - a.score);

	const matchedTableCount = matched.length;

	const selectedKeys = matched
		.slice(0, opts.maxMatchedTables)
		.map((m) => m.key);
	const selectedSet = new Set(selectedKeys);

	// Bidirectional FK expansion (BFS up to fkHops) for join reachability.
	const adj = buildAdjacency(catalog.tables);
	const neighborKeys: string[] = [];
	const visited = new Set(selectedSet);
	let frontier = [...selectedSet];
	for (let hop = 0; hop < opts.fkHops; hop++) {
		const next: string[] = [];
		for (const k of frontier) {
			for (const nb of adj.get(k) ?? []) {
				if (!visited.has(nb)) {
					visited.add(nb);
					neighborKeys.push(nb);
					next.push(nb);
				}
			}
		}
		frontier = next;
		if (frontier.length === 0) break;
	}

	// Final slice: matched (by score) first, then FK-neighbors, capped.
	const orderedKeys = [...selectedKeys, ...neighborKeys].slice(
		0,
		opts.maxSliceTables,
	);

	const tables: RetrievedTable[] = [];
	for (const key of orderedKeys) {
		const t = byKey.get(key);
		if (!t) continue;
		tables.push({
			schema: t.schema,
			name: t.name,
			description: t.description ?? null,
			rowCountEstimate: t.rowCountEstimate ?? null,
			columns: t.columns.map((c) => projectColumn(c, opts)),
			foreignKeys: t.foreignKeys,
			score: scores.get(key) ?? 0,
			reason: selectedSet.has(key) ? "matched" : "fk-neighbor",
		});
	}

	return { tables, matchedTableCount };
}
