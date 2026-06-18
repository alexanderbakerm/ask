import type { KpiFormat } from "./spec";

/**
 * Presentation formatting for the viz layer — pure, library-agnostic, and
 * unit-tested so number/currency/date rendering is consistent across the
 * renderer (axes, tooltips, data labels, tables) and never re-invented inline.
 *
 * Three numeric styles, deliberately distinct (this is what separates a BI
 * chart from a dev chart):
 *   - formatHeadline: KPI/center numbers — full grouping, NO cents ($319,603).
 *   - formatMeasure:  tooltips/table cells — full precision WITH cents
 *     ($256,492.22) so the exact figure is always inspectable.
 *   - formatAxisTick: axis ticks + bar labels — compact ($256K, 1.2M, 36).
 */

export type DateGranularity = "year" | "month" | "day";

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export function parseDateValue(v: unknown): Date | null {
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
	if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) {
		const d = new Date(v);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

/**
 * Detect grouping granularity once from the data so every tick labels
 * consistently (all month-buckets → "Oct 2025"). UTC getters match the
 * date_trunc bucket regardless of the viewer's timezone.
 */
export function dateGranularity(values: unknown[]): DateGranularity {
	let allYearStart = true;
	let allMonthStart = true;
	let any = false;
	for (const v of values) {
		const d = parseDateValue(v);
		if (!d) continue;
		any = true;
		if (!(d.getUTCMonth() === 0 && d.getUTCDate() === 1)) allYearStart = false;
		if (d.getUTCDate() !== 1) allMonthStart = false;
	}
	if (!any) return "day";
	if (allYearStart) return "year";
	if (allMonthStart) return "month";
	return "day";
}

export function formatDate(v: unknown, gran: DateGranularity): string {
	const d = parseDateValue(v);
	if (!d) return String(v ?? "");
	const year = d.getUTCFullYear();
	if (gran === "year") return String(year);
	const month = MONTHS[d.getUTCMonth()] ?? "";
	if (gran === "month") return `${month} ${year}`;
	return `${month} ${d.getUTCDate()}, ${year}`;
}

/** Headline numbers (KPI cards, donut center): grouped, no cents. */
export function formatHeadline(value: number, format?: KpiFormat): string {
	if (!Number.isFinite(value)) return "—";
	if (format === "currency") {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 0,
		}).format(value);
	}
	if (format === "percent") {
		return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
	}
	return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** Exact figures (tooltips, table cells): full grouping, cents for money. */
export function formatMeasure(value: number, format?: KpiFormat): string {
	if (!Number.isFinite(value)) return "—";
	if (format === "currency") {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 2,
		}).format(value);
	}
	if (format === "percent") {
		return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
	}
	return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Axis ticks + bar data labels: compact, currency-aware ($256K, 1.2M, 36). */
export function formatAxisTick(value: unknown, format?: KpiFormat): string {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return String(value ?? "");
	const compact = Math.abs(n) >= 1000;
	if (format === "currency") {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: "USD",
			notation: compact ? "compact" : "standard",
			maximumFractionDigits: compact ? 1 : 0,
		}).format(n);
	}
	if (format === "percent") {
		return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
	}
	if (compact) {
		return new Intl.NumberFormat(undefined, {
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(n);
	}
	return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
