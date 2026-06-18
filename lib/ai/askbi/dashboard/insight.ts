import { formatHeadline } from "../viz/format";
import type { AskBiAnswer, VizColumn, VizSpec } from "../viz/spec";
import { quartiles } from "../viz/stats";

/**
 * Deterministic, one-sentence INSIGHT derived from a chart's actual result —
 * e.g. "Amount is up 34% over the period" or "Hardware leads at $256,492 (80%
 * of the total)". No LLM: read straight from the data so it's cheap and exact.
 * Returns undefined when no meaningful insight applies (caller falls back to a
 * static description). Pure — unit-tested in isolation.
 */

function num(v: unknown): number {
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtOf(spec: VizSpec, key: string): VizColumn["format"] {
	return spec.columns.find((c) => c.key === key)?.format;
}

function trendInsight(spec: VizSpec): string | undefined {
	const { encoding, data } = spec;
	const xKey = encoding.x?.key;
	const measure = encoding.y?.[0];
	if (!xKey || !measure) return undefined;
	// Total the measure per period (handles a series dimension too), in row order.
	const byX = new Map<string, number>();
	for (const r of data) {
		const k = String(r[xKey]);
		byX.set(k, (byX.get(k) ?? 0) + num(r[measure.key]));
	}
	const vals = [...byX.values()];
	if (vals.length < 2) return undefined;
	const first = vals[0] ?? 0;
	const last = vals[vals.length - 1] ?? 0;
	const fmt = fmtOf(spec, measure.key);
	const label = measure.label.toLowerCase();
	const end = formatHeadline(last, fmt);
	if (first === 0)
		return `${cap(label)} reached ${end} by the end of the period.`;
	const pct = ((last - first) / Math.abs(first)) * 100;
	if (Math.abs(pct) < 2) return `${cap(label)} held roughly steady at ${end}.`;
	return `${cap(label)} is ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(0)}% over the period, ending at ${end}.`;
}

function breakdownInsight(spec: VizSpec): string | undefined {
	const { encoding, data } = spec;
	const catKey = encoding.x?.key ?? encoding.category?.key;
	const measKey = encoding.y?.[0]?.key ?? encoding.value?.key;
	if (!catKey || !measKey) return undefined;
	const byCat = new Map<string, number>();
	for (const r of data) {
		const k = String(r[catKey]);
		byCat.set(k, (byCat.get(k) ?? 0) + num(r[measKey]));
	}
	const entries = [...byCat.entries()];
	const total = entries.reduce((s, [, v]) => s + v, 0);
	if (entries.length === 0 || total === 0) return undefined;
	const top = entries.reduce((m, e) => (e[1] > m[1] ? e : m));
	const share = Math.round((top[1] / total) * 100);
	const val = formatHeadline(top[1], fmtOf(spec, measKey));
	return `${top[0]} leads at ${val} — ${share}% of the total across ${entries.length} ${entries.length === 1 ? "category" : "categories"}.`;
}

function distributionInsight(spec: VizSpec): string | undefined {
	const { encoding, data } = spec;
	// histogram/density use `value`; boxplot uses the measure on `y`.
	const key = encoding.value?.key ?? encoding.y?.[0]?.key;
	const label = (encoding.value ?? encoding.y?.[0])?.label;
	if (!key || !label) return undefined;
	const q = quartiles(data.map((r) => num(r[key])));
	if (!q) return undefined;
	const fmt = fmtOf(spec, key);
	return `Median ${label.toLowerCase()} is ${formatHeadline(q.median, fmt)}; most fall between ${formatHeadline(q.q1, fmt)} and ${formatHeadline(q.q3, fmt)}.`;
}

export function computeInsight(answer: AskBiAnswer): string | undefined {
	const spec = answer.primary;
	if (spec.data.length === 0) return undefined;
	switch (spec.type) {
		case "line":
		case "area":
		case "step":
		case "stackedArea":
		case "combo":
			return trendInsight(spec);
		case "bar":
		case "dotPlot":
		case "groupedBar":
		case "stackedBar":
		case "pie":
			return breakdownInsight(spec);
		case "histogram":
		case "density":
		case "boxplot":
			return distributionInsight(spec);
		default:
			return undefined;
	}
}
