import type { ColumnKind } from "@/lib/db/schema/enums";

/**
 * The visualization contract. Deliberately library-agnostic: it describes
 * *what* to draw (chart type + role-based field encodings) and carries the
 * data + provenance, but names no charting library. Recharts is the Phase 1
 * renderer, but only `components/ai/askbi/viz-renderer.tsx` knows that — the
 * agent and chooser depend on this contract alone, so the renderer can be
 * swapped in Phase 2 without touching them.
 */

export type VizType =
	| "kpi"
	| "line"
	| "area"
	| "step"
	| "bar"
	| "combo"
	| "groupedBar"
	| "stackedBar"
	| "stackedArea"
	| "dotPlot"
	| "pie"
	| "scatter"
	| "histogram"
	| "boxplot"
	| "density"
	| "violin"
	| "heatmap"
	| "sparkline"
	| "table";

/**
 * Relative footprint of a tile in the dashboard grid. Assigned deterministically
 * by the planner (and, later, refined by the LLM enrichment pass). The renderer
 * is agnostic; the dashboard grid maps these to column spans.
 */
export type TileSize = "sm" | "md" | "lg" | "full";

/**
 * Advisory hint from the LLM. STRICTLY a tiebreaker: it may only choose between
 * options the deterministic rules leave genuinely open (pie vs bar, grouped vs
 * stacked). It can never override a rule that already has a clear answer.
 */
export type VizIntent =
	| "trend"
	| "comparison"
	| "partToWhole"
	| "correlation"
	| "distribution"
	| "detail";

export type FieldRole = "dimension" | "measure" | "time";

export interface FieldRef {
	/** Key into the row objects. */
	key: string;
	label: string;
	role: FieldRole;
	dataType: ColumnKind;
}

export interface VizColumn {
	key: string;
	label: string;
	dataType: ColumnKind;
	/** How a numeric column should be rendered in a detail table (currency vs
	 * plain count). Set deterministically upstream so the renderer never guesses. */
	format?: KpiFormat;
}

export interface VizEncoding {
	/** Categorical/time axis (bar, line, grouped/stacked). */
	x?: FieldRef;
	/** One or more measures (line/bar/scatter). Primary axis for combo (bars). */
	y?: FieldRef[];
	/** Secondary-axis measures for combo charts (rendered as lines on the right). */
	yRight?: FieldRef[];
	/** Grouping dimension for grouped/stacked bars; the second (y) axis for heatmaps. */
	series?: FieldRef;
	/** Slice dimension for pie. */
	category?: FieldRef;
	/** Single value for pie/kpi/heatmap intensity. */
	value?: FieldRef;
}

export interface VizOptions {
	/** Render a bar chart horizontally (long category labels). */
	horizontal?: boolean;
	/** Render a pie as a donut (hole + center total). The modern part-to-whole
	 * default; the type stays `"pie"` so the contract is unchanged. */
	donut?: boolean;
	/** A reference line drawn across the value axis (e.g. the average of a
	 * measure), with a short label. Computed deterministically upstream. */
	referenceLine?: { value: number; label: string };
}

export interface VizMeta {
	/** The executed SQL — ALWAYS surfaced to the user. */
	sql: string;
	rowCount: number;
	/** The connector hit the row cap (more rows existed). */
	truncated: boolean;
	/** A persisted snapshot holds fewer rows than the full result. */
	snapshotTruncated?: boolean;
	/** Set only when an approximate figure is shown to the user. */
	approxNote?: string;
	notes?: string[];
}

export interface VizSpec {
	type: VizType;
	title: string;
	encoding: VizEncoding;
	options?: VizOptions;
	columns: VizColumn[];
	data: Record<string, unknown>[];
	meta: VizMeta;
	/** Preferred dashboard footprint. Advisory; the grid may clamp it. */
	tileSize?: TileSize;
	/** Hidden debug note explaining why this chart/size was chosen. */
	rationale?: string;
}

export type KpiFormat = "number" | "currency" | "percent";

/**
 * Period-over-period change for a KPI scorecard. `pct` is the signed fraction
 * (0.12 = +12%); `direction` is its sign, pre-computed so the renderer never
 * re-derives it. `positiveIsGood` flips the color semantics for "lower is
 * better" metrics (cost, bounce rate, churn) — up is then red, down green.
 */
export interface KpiDelta {
	pct: number;
	direction: "up" | "down" | "flat";
	/** Caption under the chip, e.g. "vs previous month". */
	caption?: string;
	positiveIsGood?: boolean;
}

export interface KpiSpec {
	label: string;
	value: number;
	format: KpiFormat;
	delta?: KpiDelta;
}

/**
 * One question → one answer: a primary visualization, optionally paired with a
 * single companion KPI (e.g. a Q4 trend + the Q4 total). NEVER an array of
 * independent tiles — multi-tile dashboards are Phase 2.
 */
export interface AskBiAnswer {
	primary: VizSpec;
	/** Companion KPI shown above a chart (e.g. a trend + its total). */
	kpi?: KpiSpec;
	/**
	 * Scorecard row for a single-row result: one card per measure, shown INSTEAD
	 * of a chart (a single data point is never a meaningful line/bar). Present
	 * only when `primary.type === "kpi"`.
	 */
	kpis?: KpiSpec[];
	/** The advisory intent that produced this answer, echoed so a saved query
	 * can re-render with the same intent on reopen. */
	intent?: VizIntent;
}
