import type { ColumnKind } from "@/lib/db/schema/enums";
import type {
	AskBiAnswer,
	FieldRef,
	FieldRole,
	KpiFormat,
	KpiSpec,
	VizColumn,
	VizIntent,
	VizSpec,
	VizType,
} from "./spec";

/**
 * Deterministic chart selection from the ACTUAL result shape.
 *
 * Column kinds are inferred from the returned values (not just catalog hints),
 * and cardinality decisions use the REAL distinct count of the returned rows —
 * never the catalog's approximate estimate. The LLM-supplied `intent` is
 * strictly advisory: it only breaks ties the rules leave open (pie vs bar,
 * grouped vs stacked) and can never override a rule with a clear answer. When
 * nothing fits, we fall back to a table — never a guessed chart.
 *
 * Pure (no DB / env / LLM), unit-tested in isolation.
 */

export interface ChooseVizInput {
	/** Result columns, in order. */
	columns: { name: string }[];
	rows: Record<string, unknown>[];
	sql: string;
	/** The connector hit the row cap. */
	truncated: boolean;
	/** Advisory tiebreak only. */
	intent?: VizIntent;
	title?: string;
	/**
	 * Authoritative, structure-derived roles (output column name → role) from
	 * the SQL analysis. Highest priority — a GROUP BY key is a dimension and an
	 * aggregate a measure regardless of data type.
	 */
	roleHints?: Partial<Record<string, FieldRole>>;
	/** Optional catalog type hints, used only when value inference is unknown. */
	typeHints?: Partial<Record<string, ColumnKind>>;
}

const PIE_MAX_CATEGORIES = 8;
const BAR_MAX_CATEGORIES = 50;
// A ranked bar with more nominal categories than this shows only the top N
// (the rest are disclosed via a note) — many tiny bars are unreadable.
const BAR_TOPN = 15;
const GROUPED_SERIES_MAX = 12;
// A two-dimension result is a heatmap (matrix) rather than a grouped bar when
// BOTH dimensions span several values — clustered bars become unreadable, a
// tinted matrix does not. Bounded so the grid stays legible.
const HEATMAP_MIN_PER_AXIS = 3;
const HEATMAP_MAX_PER_AXIS = 24;
const LONG_LABEL = 16;
const INFER_SAMPLE = 50;
const CURRENCY_RE = /amount|price|revenue|sales|cost|spend|total|gmv|profit/i;
// Counts/quantities take precedence over CURRENCY_RE so e.g. "total_quantity_sold"
// (which contains "total") is formatted as a plain number, not money.
const COUNT_RE =
	/quantity|qty|count|units|orders|sessions|visits|clicks|views/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

function isNumeric(v: unknown): boolean {
	if (typeof v === "number") return Number.isFinite(v);
	if (typeof v === "string") {
		const t = v.trim();
		return t !== "" && !Number.isNaN(Number(t));
	}
	return false;
}

function isDateLike(v: unknown): boolean {
	if (v instanceof Date) return true;
	return typeof v === "string" && ISO_DATE_RE.test(v.trim());
}

function toNumber(v: unknown): number {
	if (typeof v === "number") return v;
	if (typeof v === "string") return Number(v);
	return Number.NaN;
}

function humanize(key: string): string {
	const spaced = key
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function inferKind(
	values: unknown[],
	hint: ColumnKind | undefined,
): ColumnKind {
	const nonNull = values.filter((v) => v !== null && v !== undefined);
	if (nonNull.length === 0) return hint ?? "string";
	if (nonNull.every((v) => typeof v === "boolean")) return "boolean";
	// Date before number so numeric-looking dates aren't misread.
	if (nonNull.every(isDateLike)) return "datetime";
	if (nonNull.every(isNumeric)) return "number";
	return "string";
}

function distinctCount(rows: Record<string, unknown>[], key: string): number {
	const seen = new Set<unknown>();
	for (const row of rows) {
		seen.add(row[key]);
	}
	return seen.size;
}

function maxLabelLength(rows: Record<string, unknown>[], key: string): number {
	let max = 0;
	for (const row of rows) {
		const v = row[key];
		if (v != null) {
			max = Math.max(max, String(v).length);
		}
	}
	return max;
}

/** Descending sort by a numeric measure. Returns a new array (original kept). */
function sortByMeasureDesc(
	rows: Record<string, unknown>[],
	key: string,
): Record<string, unknown>[] {
	return [...rows].sort((a, b) => toNumber(b[key]) - toNumber(a[key]));
}

/** Mean of a measure across rows (finite values only); null if none. */
function meanOf(rows: Record<string, unknown>[], key: string): number | null {
	let sum = 0;
	let n = 0;
	for (const row of rows) {
		const v = toNumber(row[key]);
		if (Number.isFinite(v)) {
			sum += v;
			n += 1;
		}
	}
	return n === 0 ? null : sum / n;
}

function kpiFormat(key: string): KpiFormat {
	if (COUNT_RE.test(key)) return "number";
	return CURRENCY_RE.test(key) ? "currency" : "number";
}

function isCountMeasure(key: string): boolean {
	return COUNT_RE.test(key);
}

function isCurrencyMeasure(key: string): boolean {
	return CURRENCY_RE.test(key) && !COUNT_RE.test(key);
}

/** Peak absolute value across rows for a measure column. */
function measurePeak(rows: Record<string, unknown>[], key: string): number {
	let peak = 0;
	for (const row of rows) {
		const n = Math.abs(toNumber(row[key]));
		if (Number.isFinite(n)) peak = Math.max(peak, n);
	}
	return peak;
}

/**
 * True when two+ measures sit on such different scales that a shared Y axis
 * would hide the smaller one (e.g. revenue ~20K vs quantity ~13).
 */
function needsDualAxis(
	measures: FieldRef[],
	rows: Record<string, unknown>[],
): boolean {
	if (measures.length < 2 || rows.length < 2) return false;
	const peaks = measures
		.map((m) => measurePeak(rows, m.key))
		.filter((p) => p > 0);
	if (peaks.length < 2) return false;
	const maxPeak = Math.max(...peaks);
	const minPeak = Math.min(...peaks);
	return maxPeak / minPeak >= 10;
}

/** Split measures for a combo chart: bars on left, line(s) on right. */
function splitMeasuresForCombo(
	measures: FieldRef[],
	rows: Record<string, unknown>[],
): { left: FieldRef[]; right: FieldRef[] } {
	const counts = measures.filter((m) => isCountMeasure(m.key));
	const currency = measures.filter((m) => isCurrencyMeasure(m.key));
	if (currency.length > 0 && counts.length > 0) {
		return { left: currency, right: counts };
	}
	// Fallback: largest peak → left (bars), smallest → right (line).
	const sorted = [...measures].sort(
		(a, b) => measurePeak(rows, b.key) - measurePeak(rows, a.key),
	);
	const left = sorted.slice(0, -1);
	const right = sorted.slice(-1);
	return { left, right };
}

function roleFromKind(kind: ColumnKind): FieldRole {
	if (kind === "number") return "measure";
	if (kind === "date" || kind === "datetime" || kind === "time") return "time";
	return "dimension";
}

// Name-based guards for the raw-SELECT-no-aggregate path: keep numeric id keys
// and year/month/quarter/week columns out of the "measure" bucket.
const ID_NAME_RE = /(^|_)id$/;
const TIME_NAME_RE = /^(year|month|quarter|week|day|date)$/;
const TIME_SUFFIX_RE = /_(year|month|quarter|week|date)$/;

function nameHeuristicRole(name: string): FieldRole | undefined {
	const lc = name.toLowerCase();
	if (ID_NAME_RE.test(lc)) return "dimension";
	if (TIME_NAME_RE.test(lc) || TIME_SUFFIX_RE.test(lc)) return "time";
	return undefined;
}

export function chooseViz(input: ChooseVizInput): AskBiAnswer {
	const answer = selectViz(input);
	// Echo the intent so a saved query can re-render with it on reopen.
	return input.intent ? { ...answer, intent: input.intent } : answer;
}

function selectViz(input: ChooseVizInput): AskBiAnswer {
	const { rows, columns, sql, truncated, intent, roleHints, typeHints } = input;
	const title = input.title?.trim() || "Results";

	const sample = rows.slice(0, INFER_SAMPLE);
	const fields: FieldRef[] = columns.map((col) => {
		const kind = inferKind(
			sample.map((r) => r[col.name]),
			typeHints?.[col.name],
		);
		// Priority: structure-derived role → name heuristic → value/type inference.
		const role: FieldRole =
			roleHints?.[col.name.toLowerCase()] ??
			nameHeuristicRole(col.name) ??
			roleFromKind(kind);
		return { key: col.name, label: humanize(col.name), role, dataType: kind };
	});

	const vizColumns: VizColumn[] = fields.map((f) => ({
		key: f.key,
		label: f.label,
		dataType: f.dataType,
		// Only measures carry a money/count format; dimensions (incl. numeric ids)
		// and time columns are rendered by the table verbatim / by date rules.
		...(f.role === "measure" ? { format: kpiFormat(f.key) } : {}),
	}));

	const measures = fields.filter((f) => f.role === "measure");
	const times = fields.filter((f) => f.role === "time");
	const dims = fields.filter((f) => f.role === "dimension");
	// json / unknown data can't be charted meaningfully → force a table.
	const hasUnchartable = fields.some(
		(f) => f.dataType === "json" || f.dataType === "unknown",
	);

	const base = (
		type: VizType,
		encoding: VizSpec["encoding"],
		options?: VizSpec["options"],
		data: Record<string, unknown>[] = rows,
		notes?: string[],
	): VizSpec => ({
		type,
		title,
		encoding,
		options,
		columns: vizColumns,
		data,
		meta: {
			sql,
			rowCount: rows.length,
			truncated,
			...(notes && notes.length > 0 ? { notes } : {}),
		},
	});

	const table = (): AskBiAnswer => ({
		primary: base("table", {}),
	});

	// Companion KPI: total of the single measure (skipped when truncated, since a
	// partial sum would mislead).
	const withKpi = (answer: AskBiAnswer): AskBiAnswer => {
		if (truncated || measures.length !== 1) return answer;
		const measure = measures[0];
		if (!measure) return answer;
		let sum = 0;
		let counted = 0;
		for (const row of rows) {
			const n = toNumber(row[measure.key]);
			if (Number.isFinite(n)) {
				sum += n;
				counted += 1;
			}
		}
		if (counted === 0) return answer;
		// Avoid a redundant "Total sales (total)" — only append when the measure
		// label doesn't already read as an aggregate.
		const label = /total|sum/i.test(measure.label)
			? measure.label
			: `${measure.label} (total)`;
		return {
			...answer,
			kpi: { label, value: sum, format: kpiFormat(measure.key) },
		};
	};

	if (hasUnchartable) {
		return table();
	}

	// 1) Single-row result → KPI scorecard(s), one card per measure. A single
	// data point is never a meaningful line/bar (the sparse "1-point line"), so a
	// 1-bucket time result or a bare aggregate becomes scorecards instead. Capped
	// at 3 measures with at most one context column (dimension/time) — wider rows
	// are detail and fall through to a table.
	if (
		rows.length === 1 &&
		measures.length >= 1 &&
		measures.length <= 3 &&
		dims.length + times.length <= 1 &&
		measures[0]
	) {
		const row = rows[0];
		const cards: KpiSpec[] = measures.map((m) => ({
			label: m.label,
			value: toNumber(row?.[m.key]),
			format: kpiFormat(m.key),
		}));
		return {
			// encoding.value keeps the first measure for back-compat / reopen.
			primary: base("kpi", { value: measures[0] }),
			kpi: cards[0],
			kpis: cards,
		};
	}

	// 2) Time series → line or combo (dual axis when scales diverge).
	if (
		times.length === 1 &&
		measures.length >= 1 &&
		dims.length <= 1 &&
		times[0]
	) {
		if (measures.length >= 2 && needsDualAxis(measures, rows)) {
			const { left, right } = splitMeasuresForCombo(measures, rows);
			if (left.length > 0 && right.length > 0) {
				return {
					primary: base("combo", {
						x: times[0],
						y: left,
						yRight: right,
						...(dims[0] ? { series: dims[0] } : {}),
					}),
				};
			}
		}
		// Explicit part-to-whole over a FEW time buckets → donut by period (e.g.
		// "Q4 sales by month as a pie" = each month's share of the quarter). The
		// donut's center shows the total, so no separate companion KPI. With many
		// buckets a pie is unreadable, so fall through to the line.
		if (
			intent === "partToWhole" &&
			measures.length === 1 &&
			dims.length === 0 &&
			measures[0] &&
			distinctCount(rows, times[0].key) <= PIE_MAX_CATEGORIES
		) {
			return {
				primary: base(
					"pie",
					{ category: times[0], value: measures[0] },
					{ donut: true },
				),
			};
		}
		// Part-to-whole over time WITH a series dimension → stacked area
		// (composition over time), the area analogue of the stacked bar.
		if (
			intent === "partToWhole" &&
			dims.length === 1 &&
			measures.length === 1 &&
			dims[0] &&
			measures[0]
		) {
			return withKpi({
				primary: base("stackedArea", {
					x: times[0],
					series: dims[0],
					y: [measures[0]],
				}),
			});
		}
		return withKpi({
			primary: base("line", {
				x: times[0],
				y: measures,
				...(dims[0] ? { series: dims[0] } : {}),
			}),
		});
	}

	// 3) One categorical dimension + measure(s).
	if (
		times.length === 0 &&
		dims.length === 1 &&
		measures.length >= 1 &&
		dims[0]
	) {
		const dim = dims[0];
		const distinct = distinctCount(rows, dim.key);
		// Distribution by category → box plot (raw per-group values summarized).
		if (intent === "distribution" && measures.length === 1 && measures[0]) {
			return { primary: base("boxplot", { x: dim, y: [measures[0]] }) };
		}
		// pie only when part-to-whole intent AND few enough slices (real count).
		if (
			intent === "partToWhole" &&
			measures.length === 1 &&
			distinct <= PIE_MAX_CATEGORIES &&
			measures[0]
		) {
			// Donut (center total) is the default part-to-whole rendering; the type
			// stays "pie" so persisted specs and the contract are unchanged. The
			// center total stands in for a companion KPI, so we don't add one.
			// Rank slices by value (descending) for nominal categories.
			const slices =
				dim.dataType === "string"
					? sortByMeasureDesc(rows, measures[0].key)
					: rows;
			return {
				primary: base(
					"pie",
					{ category: dim, value: measures[0] },
					{ donut: true },
					slices,
				),
			};
		}
		if (distinct <= BAR_MAX_CATEGORIES) {
			const horizontal = maxLabelLength(rows, dim.key) > LONG_LABEL;
			// Rank nominal categories by the primary measure (descending) — the BI
			// default for "X by category". Numeric/ordinal dimensions (ids, rating
			// buckets) keep their natural order; time series are never reordered.
			const ranked =
				dim.dataType === "string" && measures[0]
					? sortByMeasureDesc(rows, measures[0].key)
					: rows;
			// "comparison" intent → a dot plot (cleaner than bars for ranking).
			if (intent === "comparison" && measures.length === 1 && measures[0]) {
				const avg = rows.length >= 3 ? meanOf(rows, measures[0].key) : null;
				return withKpi({
					primary: base(
						"dotPlot",
						{ x: dim, y: [measures[0]] },
						avg != null
							? { referenceLine: { value: avg, label: "Avg" } }
							: undefined,
						ranked,
					),
				});
			}
			if (measures.length >= 2 && needsDualAxis(measures, rows)) {
				const { left, right } = splitMeasuresForCombo(measures, rows);
				if (left.length > 0 && right.length > 0) {
					return {
						primary: base(
							"combo",
							{ x: dim, y: left, yRight: right },
							undefined,
							ranked,
						),
					};
				}
			}
			// Top-N: a ranked nominal bar with many categories is unreadable — show
			// the top N (already sorted desc) and disclose the rest via a note.
			const isTopN = dim.dataType === "string" && distinct > BAR_TOPN;
			const barData = isTopN ? ranked.slice(0, BAR_TOPN) : ranked;
			const notes =
				isTopN && measures[0]
					? [`Top ${BAR_TOPN} of ${distinct} by ${measures[0].label}`]
					: undefined;
			// Average reference line: only for a single measure across ≥3 bars,
			// where "above/below average" is a meaningful read. The average is over
			// ALL categories, not just the shown top N.
			const avg =
				measures.length === 1 && measures[0] && rows.length >= 3
					? meanOf(rows, measures[0].key)
					: null;
			const barOptions: VizSpec["options"] = {
				horizontal,
				...(avg != null ? { referenceLine: { value: avg, label: "Avg" } } : {}),
			};
			return withKpi({
				primary: base(
					"bar",
					{ x: dim, y: measures },
					barOptions,
					barData,
					notes,
				),
			});
		}
		return table(); // too many categories to chart legibly
	}

	// 4) Two measures, no dimension → scatter (correlation).
	if (
		times.length === 0 &&
		dims.length === 0 &&
		measures.length === 2 &&
		rows.length > 1 &&
		measures[0] &&
		measures[1]
	) {
		return {
			primary: base("scatter", { x: measures[0], y: [measures[1]] }),
		};
	}

	// 4b) A single numeric column with many raw rows → distribution. Continuous
	// data (many distinct values) with explicit "distribution" intent reads best
	// as a smooth density; otherwise a binned histogram.
	if (
		times.length === 0 &&
		dims.length === 0 &&
		measures.length === 1 &&
		measures[0] &&
		(rows.length >= 8 || intent === "distribution")
	) {
		if (
			intent === "distribution" &&
			distinctCount(rows, measures[0].key) > 20
		) {
			return { primary: base("density", { value: measures[0] }) };
		}
		return { primary: base("histogram", { value: measures[0] }) };
	}

	// 5) Two dimensions + one measure → grouped (or stacked) bar.
	if (
		times.length === 0 &&
		dims.length === 2 &&
		measures.length === 1 &&
		dims[0] &&
		dims[1] &&
		measures[0]
	) {
		const [d1, d2] = [dims[0], dims[1]];
		const c1 = distinctCount(rows, d1.key);
		const c2 = distinctCount(rows, d2.key);
		// Heatmap: a true matrix (both axes have several values) reads far better
		// than a grouped bar with dozens of tiny clustered bars. Not for
		// part-to-whole — that's a stacked composition, not a matrix.
		if (
			intent !== "partToWhole" &&
			c1 >= HEATMAP_MIN_PER_AXIS &&
			c2 >= HEATMAP_MIN_PER_AXIS &&
			c1 <= HEATMAP_MAX_PER_AXIS &&
			c2 <= HEATMAP_MAX_PER_AXIS &&
			c1 * c2 >= 12
		) {
			return {
				primary: base("heatmap", { x: d1, series: d2, value: measures[0] }),
			};
		}
		if (c1 <= BAR_MAX_CATEGORIES && c2 <= GROUPED_SERIES_MAX) {
			const type: VizType =
				intent === "partToWhole" ? "stackedBar" : "groupedBar";
			return withKpi({
				primary: base(type, { x: d1, series: d2, y: [measures[0]] }),
			});
		}
		return table();
	}

	// 6) Anything else → table (never a guessed chart).
	return table();
}
