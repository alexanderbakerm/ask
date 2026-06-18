import type { KpiDelta } from "../viz/spec";

/**
 * Period-over-period change for a KPI scorecard.
 *
 * Takes the rows of a small "period, value" query (the last two periods present
 * in the data) and computes the signed change of the latest period vs the prior
 * one. Pure (no DB / env), unit-tested in isolation. Returns `undefined` when a
 * meaningful delta can't be formed (fewer than two periods, or a zero base).
 */

function toNum(v: unknown): number | null {
	if (typeof v === "number") return Number.isFinite(v) ? v : null;
	if (typeof v === "string") {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

/** Sort key for a period value (Date or ISO-ish string) → epoch ms. */
function periodTime(v: unknown): number {
	if (v instanceof Date) return v.getTime();
	const d = new Date(String(v));
	const t = d.getTime();
	return Number.isFinite(t) ? t : 0;
}

const FLAT_THRESHOLD = 0.005; // < 0.5% reads as "no change"

export function computePeriodDelta(
	rows: Record<string, unknown>[],
	periodKey: string,
	valueKey: string,
	opts: { caption?: string; positiveIsGood?: boolean } = {},
): KpiDelta | undefined {
	if (rows.length < 2) return undefined;
	// Newest period first, regardless of the query's row order.
	const sorted = [...rows].sort(
		(a, b) => periodTime(b[periodKey]) - periodTime(a[periodKey]),
	);
	const latest = toNum(sorted[0]?.[valueKey]);
	const prior = toNum(sorted[1]?.[valueKey]);
	if (latest == null || prior == null || prior === 0) return undefined;

	const pct = (latest - prior) / Math.abs(prior);
	const direction: KpiDelta["direction"] =
		Math.abs(pct) < FLAT_THRESHOLD ? "flat" : pct > 0 ? "up" : "down";

	return {
		pct,
		direction,
		...(opts.caption ? { caption: opts.caption } : {}),
		...(opts.positiveIsGood != null
			? { positiveIsGood: opts.positiveIsGood }
			: {}),
	};
}
