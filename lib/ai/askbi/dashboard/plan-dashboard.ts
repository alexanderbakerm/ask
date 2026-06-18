import type {
	CatalogColumn,
	CatalogTable,
	SourceCatalog,
} from "@/lib/ai/askbi/retrieve-catalog";
import type { TileSize } from "@/lib/ai/askbi/viz/spec";

/**
 * Deterministic dashboard planner — the "auto-dashboard" engine.
 *
 * Given a data source's introspected catalog, it derives the most important,
 * context-aware analyses (KPIs + 3–5 charts) and emits SQL for each. No LLM:
 * every tile is built from the catalog's real tables/columns/joins, so it's
 * cheap, instant, and reproducible. Every generated SQL is a plain read-only
 * SELECT that still passes through the execute chokepoint (SELECT-only AST +
 * catalog grounding + injected LIMIT + read-only tx) — this planner is NOT a
 * bypass; it just proposes the SQL the chokepoint then validates and runs.
 *
 * Charts are scored for importance and interleaved across measures (so a
 * sales source yields e.g. revenue-over-time, revenue-by-category,
 * units-over-time, units-by-category — not four revenue charts). Joins come
 * from declared FKs OR are inferred from `<thing>_id` → `<things>.id` when a
 * source has no declared FKs (common in analytics schemas).
 *
 * Pure (no DB / env / LLM), unit-tested in isolation. PostgreSQL dialect.
 */

export type SqlDialect = "postgres";

export interface DashboardTileSpec {
	title: string;
	sql: string;
	kind: "kpi" | "trend" | "breakdown" | "heatmap";
	/** One-sentence, plain-English explanation shown under the chart. */
	description?: string;
	/** Footprint in the dashboard grid (assigned after selection). */
	tileSize?: TileSize;
	/** Hidden debug note: why this tile/size was chosen. */
	rationale?: string;
	/**
	 * KPI tiles only: a 2-row period-over-period query (period, value) used to
	 * compute a ▲/▼ delta chip. Runs through the same chokepoint as `sql`.
	 */
	deltaSql?: string;
	deltaCaption?: string;
	/** KPI tiles: whether an increase is "good" (green). False for cost/churn. */
	positiveIsGood?: boolean;
}

export interface PlanOptions {
	dialect?: SqlDialect;
	maxKpis?: number;
	/** Target 3, hard max 5 — the most important charts only. */
	maxCharts?: number;
	/** Overall cap (kpis + charts); defaults to maxKpis + maxCharts. */
	maxTiles?: number;
	maxFactTables?: number;
	dimMaxDistinct?: number;
	breakdownLimit?: number;
}

const DEFAULTS = {
	dialect: "postgres" as SqlDialect,
	maxKpis: 4,
	maxCharts: 5,
	maxFactTables: 3,
	dimMaxDistinct: 50,
	breakdownLimit: 25,
};

// ---- Column classification --------------------------------------------------

const ID_NAME_RE = /(^|_)id$/i;
const CURRENCY_RE = /amount|price|revenue|sales|cost|spend|gmv|profit|total/i;
const AVERAGE_RE = /price|rate|ratio|avg|average|percent|score|margin/i;
const LABEL_NAME_RE =
	/^(name|title|label|category|type|status|stage|segment|region|channel)$/i;
// Measures where a DECREASE is the good outcome (so a ▼ chip is green, ▲ red).
const LOWER_IS_BETTER_RE = /cost|spend|churn|bounce|refund|complaint|error|abandon|latency/i;

function positiveIsGoodFor(name: string): boolean {
	return !LOWER_IS_BETTER_RE.test(name);
}

function isMeasure(col: CatalogColumn): boolean {
	return (
		col.normalizedType === "number" &&
		!col.isPrimaryKey &&
		!ID_NAME_RE.test(col.name)
	);
}

function isTime(col: CatalogColumn): boolean {
	return (
		col.normalizedType === "date" ||
		col.normalizedType === "datetime" ||
		col.normalizedType === "time"
	);
}

function isDimension(col: CatalogColumn, dimMaxDistinct: number): boolean {
	if (col.normalizedType !== "string" && col.normalizedType !== "boolean") {
		return false;
	}
	if (col.isPrimaryKey) return false;
	return col.distinctCount == null || col.distinctCount <= dimMaxDistinct;
}

function aggFor(name: string): "SUM" | "AVG" {
	return AVERAGE_RE.test(name) ? "AVG" : "SUM";
}

function measureRank(col: CatalogColumn): number {
	return CURRENCY_RE.test(col.name) && !AVERAGE_RE.test(col.name) ? 0 : 1;
}

function humanize(key: string): string {
	const spaced = key
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---- Postgres SQL fragments -------------------------------------------------

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;
const qt = (schema: string, table: string): string =>
	`${q(schema)}.${q(table)}`;
const aggExpr = (agg: string, alias: string, col: string): string =>
	`${agg}(${alias}.${q(col)})`;
const outAlias = (agg: string, col: string): string =>
	`${agg === "AVG" ? "avg" : "total"}_${col}`;

// ---- Joins (declared FKs + inferred `<x>_id` → `<x>s`.id) --------------------

interface Join {
	column: string;
	dimTable: CatalogTable;
	dimPk: string;
	label: CatalogColumn;
}

function bestLabelColumn(
	table: CatalogTable,
	dimMaxDistinct: number,
): CatalogColumn | undefined {
	const dims = table.columns.filter((c) => isDimension(c, dimMaxDistinct));
	if (dims.length === 0) return undefined;
	const labeled = dims.filter((c) => LABEL_NAME_RE.test(c.name));
	const pool = labeled.length > 0 ? labeled : dims;
	return [...pool].sort(
		(a, b) => (a.distinctCount ?? 1e9) - (b.distinctCount ?? 1e9),
	)[0];
}

function findTable(
	byKey: Map<string, CatalogTable>,
	schema: string,
	names: string[],
): CatalogTable | undefined {
	for (const n of names) {
		const same = byKey.get(`${schema.toLowerCase()}.${n}`);
		if (same) return same;
	}
	for (const t of byKey.values()) {
		if (names.includes(t.name.toLowerCase())) return t;
	}
	return undefined;
}

function joinsFor(
	table: CatalogTable,
	byKey: Map<string, CatalogTable>,
	dimMaxDistinct: number,
): Join[] {
	const result: Join[] = [];
	const used = new Set<string>();

	for (const fk of table.foreignKeys) {
		const dim = byKey.get(
			`${fk.referencesSchema.toLowerCase()}.${fk.referencesTable.toLowerCase()}`,
		);
		const label = dim && bestLabelColumn(dim, dimMaxDistinct);
		if (dim && label) {
			result.push({
				column: fk.column,
				dimTable: dim,
				dimPk: fk.referencesColumn,
				label,
			});
			used.add(fk.column.toLowerCase());
		}
	}

	// Inferred: a `<thing>_id` column → a table named `<thing>s`/`<thing>` with a PK.
	for (const col of table.columns) {
		if (col.isPrimaryKey) continue;
		const m = /^(.+)_id$/.exec(col.name.toLowerCase());
		if (!m?.[1] || used.has(col.name.toLowerCase())) continue;
		const dim = findTable(byKey, table.schema, [`${m[1]}s`, m[1]]);
		if (!dim || dim === table) continue;
		// Prefer a declared PK, but fall back to a column literally named "id" —
		// introspection doesn't always capture PK flags, and `<x>_id → <x>s.id`
		// is the overwhelmingly common convention.
		const pk =
			dim.columns.find((c) => c.isPrimaryKey) ??
			dim.columns.find((c) => /^id$/i.test(c.name));
		const label = bestLabelColumn(dim, dimMaxDistinct);
		if (pk && label) {
			result.push({ column: col.name, dimTable: dim, dimPk: pk.name, label });
			used.add(col.name.toLowerCase());
		}
	}
	return result;
}

// ---- Planner ----------------------------------------------------------------

interface FactTable {
	table: CatalogTable;
	measures: CatalogColumn[];
	times: CatalogColumn[];
	localDims: CatalogColumn[];
}

function scoreTables(
	catalog: SourceCatalog,
	dimMaxDistinct: number,
): FactTable[] {
	return catalog.tables
		.map((table) => ({
			table,
			measures: table.columns
				.filter(isMeasure)
				.sort((a, b) => measureRank(a) - measureRank(b)),
			times: table.columns.filter(isTime),
			localDims: table.columns.filter((c) => isDimension(c, dimMaxDistinct)),
		}))
		.filter((s) => s.measures.length > 0)
		.sort(
			(a, b) =>
				b.table.foreignKeys.length +
				b.times.length -
				(a.table.foreignKeys.length + a.times.length),
		);
}

interface Scored {
	spec: DashboardTileSpec;
	priority: number; // lower = more important
}

/**
 * Two-up layout: charts pair into a 2-column grid (half-width "md"), so each row
 * holds two cards. Heatmaps span the full row — a (dimension × month) matrix
 * needs the width to stay legible. A lone trailing half-tile is widened to full
 * so a row never ends with an empty half.
 */
function assignChartSizes(charts: DashboardTileSpec[]): void {
	let mdCount = 0;
	for (const c of charts) {
		if (c.kind === "heatmap") {
			c.tileSize = "full";
		} else {
			c.tileSize = "md";
			mdCount += 1;
		}
	}
	if (mdCount % 2 === 1) {
		for (let i = charts.length - 1; i >= 0; i -= 1) {
			const c = charts[i];
			if (c?.tileSize === "md") {
				c.tileSize = "full";
				break;
			}
		}
	}
}

export function planDashboard(
	catalog: SourceCatalog,
	options: PlanOptions = {},
): DashboardTileSpec[] {
	const opts = { ...DEFAULTS, ...options };
	const maxTiles = opts.maxTiles ?? opts.maxKpis + opts.maxCharts;
	const byKey = new Map<string, CatalogTable>();
	for (const t of catalog.tables) {
		byKey.set(`${t.schema.toLowerCase()}.${t.name.toLowerCase()}`, t);
	}

	const facts = scoreTables(catalog, opts.dimMaxDistinct).slice(
		0,
		opts.maxFactTables,
	);

	const kpiCandidates: Scored[] = [];
	const chartCandidates: Scored[] = [];

	facts.forEach((fact, ft) => {
		const { table, measures, times, localDims } = fact;
		const from = `${qt(table.schema, table.name)} t`;
		const joins = joinsFor(table, byKey, opts.dimMaxDistinct);

		measures.forEach((m, mi) => {
			const agg = aggFor(m.name);
			const mLabel = humanize(m.name);
			const measure = mLabel.toLowerCase();
			const noun = agg === "AVG" ? "Average" : "Total";
			const alias = outAlias(agg, m.name);
			const measureBase = ft * 1000 + mi * 30;

			const time = times[0];

			// KPI: total/avg of the measure (money measures sort first). When a date
			// column exists, attach a period-over-period delta query (last two months
			// present in the data) so the scorecard shows a ▲/▼ change chip.
			kpiCandidates.push({
				priority: measureRank(m) * 100 + ft * 10 + mi,
				spec: {
					title: `${agg === "AVG" ? "Average" : "Total"} ${mLabel.toLowerCase()}`,
					kind: "kpi",
					rationale: "Headline total/average of a key measure.",
					sql: `SELECT ${aggExpr(agg, "t", m.name)} AS ${q(alias)} FROM ${from}`,
					...(time
						? {
								deltaSql:
									`SELECT to_char(t.${q(time.name)}, 'YYYY-MM') AS ${q("period")}, ` +
									`${aggExpr(agg, "t", m.name)} AS ${q(alias)} FROM ${from} ` +
									`GROUP BY 1 ORDER BY 1 DESC LIMIT 2`,
								deltaCaption: "vs previous month",
								positiveIsGood: positiveIsGoodFor(m.name),
							}
						: {}),
				},
			});

			// Trend over time (one per measure, if a date column exists).
			if (time) {
				chartCandidates.push({
					priority: measureBase,
					spec: {
						title: `${mLabel} over time`,
						kind: "trend",
						rationale: "Numeric measure over a date column → time series.",
						description: `${noun} ${measure} by month across the available date range.`,
						sql:
							`SELECT date_trunc('month', t.${q(time.name)}) AS ${q("month")}, ` +
							`${aggExpr(agg, "t", m.name)} AS ${q(alias)} FROM ${from} ` +
							`GROUP BY 1 ORDER BY 1`,
					},
				});
			}

			// Breakdown by the single best join dimension (e.g. revenue by category).
			const join = joins[0];
			if (join) {
				chartCandidates.push({
					priority: measureBase + 10,
					spec: {
						title: `${mLabel} by ${humanize(join.label.name).toLowerCase()}`,
						kind: "breakdown",
						rationale: "Measure across a joined dimension → ranked bar.",
						description: `${noun} ${measure} by ${humanize(join.label.name).toLowerCase()}, ranked highest to lowest.`,
						sql:
							`SELECT d.${q(join.label.name)} AS ${q(join.label.name)}, ${aggExpr(agg, "t", m.name)} AS ${q(alias)} ` +
							`FROM ${from} JOIN ${qt(join.dimTable.schema, join.dimTable.name)} d ON t.${q(join.column)} = d.${q(join.dimPk)} ` +
							`GROUP BY 1 ORDER BY 2 DESC LIMIT ${opts.breakdownLimit}`,
					},
				});
			}

			// Breakdown by a same-table dimension (no join needed).
			const localDim = localDims[0];
			if (localDim) {
				chartCandidates.push({
					priority: measureBase + 20,
					spec: {
						title: `${mLabel} by ${humanize(localDim.name).toLowerCase()}`,
						kind: "breakdown",
						rationale: "Measure across a low-cardinality dimension → ranked bar.",
						description: `${noun} ${measure} by ${humanize(localDim.name).toLowerCase()}, ranked highest to lowest.`,
						sql:
							`SELECT t.${q(localDim.name)} AS ${q(localDim.name)}, ${aggExpr(agg, "t", m.name)} AS ${q(alias)} ` +
							`FROM ${from} GROUP BY 1 ORDER BY 2 DESC LIMIT ${opts.breakdownLimit}`,
					},
				});
			}

			// Heatmap (primary measure only): the measure across a dimension AND
			// month → a tinted matrix. Far more legible than a many-series bar, and
			// a signature "BI" tile. Uses the best dimension (a join's label, else a
			// same-table dimension) on one axis and calendar month on the other.
			if (mi === 0 && time) {
				const hdim = join
					? {
							label: join.label.name,
							select: `d.${q(join.label.name)} AS ${q(join.label.name)}`,
							joinClause: ` JOIN ${qt(join.dimTable.schema, join.dimTable.name)} d ON t.${q(join.column)} = d.${q(join.dimPk)}`,
						}
					: localDim
						? {
								label: localDim.name,
								select: `t.${q(localDim.name)} AS ${q(localDim.name)}`,
								joinClause: "",
							}
						: null;
				if (hdim) {
					const dlabel = humanize(hdim.label).toLowerCase();
					chartCandidates.push({
						priority: measureBase + 15,
						spec: {
							title: `${mLabel} by ${dlabel} and month`,
							kind: "heatmap",
							rationale:
								"Two categorical axes (dimension × month) with a measure → heatmap.",
							description: `${noun} ${measure} across ${dlabel} and month — darker cells are higher.`,
							// Alias the month bucket as a NON-time name ("period") so the
							// chooser reads it as a string dimension (two dims → heatmap),
							// not a time axis (which would render a multi-line trend).
							sql:
								`SELECT to_char(t.${q(time.name)}, 'YYYY-MM') AS ${q("period")}, ` +
								`${hdim.select}, ${aggExpr(agg, "t", m.name)} AS ${q(alias)} ` +
								`FROM ${from}${hdim.joinClause} GROUP BY 1, 2 ORDER BY 1, 2`,
						},
					});
				}
			}
		});
	});

	const take = (cands: Scored[], limit: number): DashboardTileSpec[] => {
		const seen = new Set<string>();
		const out: DashboardTileSpec[] = [];
		for (const c of [...cands].sort((a, b) => a.priority - b.priority)) {
			if (seen.has(c.spec.title)) continue;
			seen.add(c.spec.title);
			out.push(c.spec);
			if (out.length >= limit) break;
		}
		return out;
	};

	const kpis = take(kpiCandidates, opts.maxKpis);
	for (const k of kpis) {
		k.tileSize = "sm";
	}
	const charts = take(chartCandidates, opts.maxCharts);
	assignChartSizes(charts);
	return [...kpis, ...charts].slice(0, maxTiles);
}
