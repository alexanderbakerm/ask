import { describe, expect, it } from "vitest";
import {
	dateGranularity,
	formatAxisTick,
	formatDate,
	formatHeadline,
	formatMeasure,
	parseDateValue,
} from "./format";

describe("formatHeadline — KPI numbers (no cents)", () => {
	it("currency drops cents and groups", () => {
		const out = formatHeadline(319603.12, "currency");
		expect(out).toContain("$");
		expect(out).toContain("319,603");
		expect(out).not.toContain(".12");
	});

	it("counts group without decimals", () => {
		expect(formatHeadline(1200, "number")).toBe("1,200");
	});
});

describe("formatMeasure — exact figures (cents)", () => {
	it("currency keeps cents", () => {
		const out = formatMeasure(256492.22, "currency");
		expect(out).toContain("$");
		expect(out).toContain("256,492.22");
	});

	it("currency shows consistent 2-decimal cents, even for round values", () => {
		// Exact figures read more professionally with uniform cents
		// ($256,492.22 alongside $9,552.00) than a mix of cents and no-cents.
		expect(formatMeasure(9552, "currency")).toContain("9,552.00");
	});

	it("percent appends a unit", () => {
		expect(formatMeasure(12.5, "percent")).toBe("12.5%");
	});

	it("non-finite → em dash", () => {
		expect(formatMeasure(Number.NaN, "number")).toBe("—");
	});
});

describe("formatAxisTick — compact, currency-aware", () => {
	it("compacts thousands as currency", () => {
		const out = formatAxisTick(256492, "currency");
		expect(out).toContain("$256");
		expect(out).toContain("K");
	});

	it("compacts plain numbers", () => {
		expect(formatAxisTick(63571, "number")).toBe("63.6K");
	});

	it("small numbers stay whole", () => {
		expect(formatAxisTick(36, "number")).toBe("36");
	});

	it("small currency keeps the symbol without cents", () => {
		const out = formatAxisTick(952, "currency");
		expect(out).toContain("$952");
	});
});

describe("date helpers", () => {
	it("detects month granularity from first-of-month buckets", () => {
		expect(dateGranularity(["2025-10-01", "2025-11-01", "2025-12-01"])).toBe(
			"month",
		);
	});

	it("detects year granularity from Jan-1 buckets", () => {
		expect(dateGranularity(["2024-01-01", "2025-01-01"])).toBe("year");
	});

	it("formats a month bucket as 'Oct 2025' (timezone-safe)", () => {
		expect(formatDate("2025-10-01T00:00:00.000Z", "month")).toBe("Oct 2025");
	});

	it("parseDateValue rejects non-dates", () => {
		expect(parseDateValue("Hardware")).toBeNull();
		expect(parseDateValue(42)).toBeNull();
	});
});
