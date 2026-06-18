import { describe, expect, it } from "vitest";
import { histogramBins, kde, quartiles } from "./stats";

describe("histogramBins", () => {
	it("returns no bins for empty / all-non-finite input", () => {
		expect(histogramBins([])).toEqual([]);
		expect(histogramBins([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([]);
	});

	it("collapses a single distinct value into one bin", () => {
		const bins = histogramBins([5, 5, 5]);
		expect(bins).toHaveLength(1);
		expect(bins[0]?.count).toBe(3);
	});

	it("bins preserve the total count and span min..max", () => {
		const values = Array.from({ length: 100 }, (_, i) => i); // 0..99
		const bins = histogramBins(values);
		expect(bins.reduce((s, b) => s + b.count, 0)).toBe(100);
		expect(bins[0]?.x0).toBe(0);
		expect(bins[bins.length - 1]?.x1).toBe(99);
		// √100 = 10 bins (clamped to maxBins=20).
		expect(bins.length).toBe(10);
	});

	it("puts the maximum value in the last bin (right-closed)", () => {
		const bins = histogramBins([0, 0, 10]);
		expect(bins[bins.length - 1]?.count).toBeGreaterThanOrEqual(1);
		expect(bins.reduce((s, b) => s + b.count, 0)).toBe(3);
	});

	it("respects maxBins", () => {
		const values = Array.from({ length: 10000 }, (_, i) => i);
		expect(histogramBins(values, 12).length).toBeLessThanOrEqual(12);
	});
});

describe("quartiles", () => {
	it("returns null for empty input", () => {
		expect(quartiles([])).toBeNull();
	});

	it("computes the five-number summary (R type-7)", () => {
		const q = quartiles([1, 2, 3, 4, 5]);
		expect(q).toEqual({ min: 1, q1: 2, median: 3, q3: 4, max: 5 });
	});

	it("interpolates between samples", () => {
		const q = quartiles([1, 2, 3, 4]);
		expect(q?.median).toBe(2.5);
		expect(q?.q1).toBeCloseTo(1.75);
		expect(q?.q3).toBeCloseTo(3.25);
	});
});

describe("kde", () => {
	it("returns nothing for empty input", () => {
		expect(kde([])).toEqual([]);
	});

	it("returns steps+1 non-negative points spanning the data", () => {
		const pts = kde([1, 2, 2, 3, 3, 3, 4, 5], 20);
		expect(pts).toHaveLength(21);
		expect(pts.every((p) => p.y >= 0)).toBe(true);
		expect(pts[0]?.x).toBeLessThan(1);
		expect(pts[pts.length - 1]?.x).toBeGreaterThan(5);
	});

	it("peaks near the densest region", () => {
		const pts = kde([0, 5, 5, 5, 5, 10], 40);
		const peak = pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]!);
		expect(peak.x).toBeGreaterThan(3);
		expect(peak.x).toBeLessThan(7);
	});
});
