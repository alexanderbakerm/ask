/**
 * Pure statistics for distribution charts (histogram now; box plot + KDE next).
 * No DB / env / charting lib — unit-tested in isolation.
 */

export interface HistogramBin {
	x0: number;
	x1: number;
	mid: number;
	count: number;
	label: string;
}

/** Light rounding for human-readable bin labels. */
function roundNice(n: number): number {
	const abs = Math.abs(n);
	if (abs === 0) return 0;
	if (abs >= 100) return Math.round(n);
	if (abs >= 1) return Math.round(n * 10) / 10;
	return Math.round(n * 100) / 100;
}

/**
 * Bin numeric values into a histogram. Bin count uses the square-root rule
 * (clamped to `maxBins`), a sensible default for typical result sizes. The max
 * value falls into the last bin (right-closed final interval).
 */
export function histogramBins(values: number[], maxBins = 20): HistogramBin[] {
	const nums = values.filter((v) => Number.isFinite(v));
	if (nums.length === 0) return [];
	const min = Math.min(...nums);
	const max = Math.max(...nums);
	if (min === max) {
		return [
			{
				x0: min,
				x1: max,
				mid: min,
				count: nums.length,
				label: `${roundNice(min)}`,
			},
		];
	}
	const binCount = Math.max(
		1,
		Math.min(maxBins, Math.ceil(Math.sqrt(nums.length))),
	);
	const width = (max - min) / binCount;
	const counts = new Array<number>(binCount).fill(0);
	for (const v of nums) {
		let idx = Math.floor((v - min) / width);
		if (idx >= binCount) idx = binCount - 1;
		if (idx < 0) idx = 0;
		counts[idx] = (counts[idx] ?? 0) + 1;
	}
	return counts.map((count, i) => {
		const x0 = min + i * width;
		const x1 = min + (i + 1) * width;
		return {
			x0,
			x1,
			mid: (x0 + x1) / 2,
			count,
			label: `${roundNice(x0)}–${roundNice(x1)}`,
		};
	});
}

export interface FiveNumber {
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
}

/** Five-number summary via linear interpolation (R type-7), for box plots. */
export function quartiles(values: number[]): FiveNumber | null {
	const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
	if (s.length === 0) return null;
	const at = (p: number): number => {
		const idx = (s.length - 1) * p;
		const lo = Math.floor(idx);
		const hi = Math.ceil(idx);
		const a = s[lo] ?? 0;
		const b = s[hi] ?? a;
		return lo === hi ? a : a + (b - a) * (idx - lo);
	};
	return {
		min: s[0] ?? 0,
		q1: at(0.25),
		median: at(0.5),
		q3: at(0.75),
		max: s[s.length - 1] ?? 0,
	};
}

export interface DensityPoint {
	x: number;
	y: number;
}

/**
 * Gaussian kernel density estimate with Silverman's-rule bandwidth — the smooth
 * version of a histogram (density / violin plots). Returns `steps + 1` points.
 */
export function kde(values: number[], steps = 48): DensityPoint[] {
	const s = values.filter((v) => Number.isFinite(v));
	const n = s.length;
	if (n === 0) return [];
	const mean = s.reduce((a, b) => a + b, 0) / n;
	const variance =
		s.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
	const sd = Math.sqrt(variance) || 1;
	const h = 1.06 * sd * n ** (-1 / 5) || 1; // Silverman
	const min = Math.min(...s);
	const max = Math.max(...s);
	const pad = h * 2;
	const lo = min - pad;
	const hi = max + pad;
	const norm = 1 / (n * h * Math.sqrt(2 * Math.PI));
	const out: DensityPoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const x = lo + ((hi - lo) * i) / steps;
		let y = 0;
		for (const v of s) {
			const u = (x - v) / h;
			y += Math.exp(-0.5 * u * u);
		}
		out.push({ x, y: y * norm });
	}
	return out;
}
