import { describe, expect, it } from "vitest";
import { computePeriodDelta } from "./delta";

describe("computePeriodDelta", () => {
	it("computes a positive change of the latest period vs the prior one", () => {
		const rows = [
			{ period: "2025-12", total: "120" },
			{ period: "2025-11", total: "100" },
		];
		const d = computePeriodDelta(rows, "period", "total");
		expect(d?.direction).toBe("up");
		expect(d?.pct).toBeCloseTo(0.2, 5);
	});

	it("computes a negative change", () => {
		const rows = [
			{ period: "2025-12", total: 80 },
			{ period: "2025-11", total: 100 },
		];
		const d = computePeriodDelta(rows, "period", "total");
		expect(d?.direction).toBe("down");
		expect(d?.pct).toBeCloseTo(-0.2, 5);
	});

	it("identifies the latest period regardless of row order (incl. Date values)", () => {
		const rows = [
			{ period: new Date("2025-11-01T00:00:00Z"), total: 100 },
			{ period: new Date("2025-12-01T00:00:00Z"), total: 150 },
		];
		const d = computePeriodDelta(rows, "period", "total");
		expect(d?.direction).toBe("up");
		expect(d?.pct).toBeCloseTo(0.5, 5);
	});

	it("reports a tiny change as flat", () => {
		const rows = [
			{ period: "2025-12", total: 100.2 },
			{ period: "2025-11", total: 100 },
		];
		expect(computePeriodDelta(rows, "period", "total")?.direction).toBe("flat");
	});

	it("passes through caption and positiveIsGood", () => {
		const rows = [
			{ period: "2025-12", total: 120 },
			{ period: "2025-11", total: 100 },
		];
		const d = computePeriodDelta(rows, "period", "total", {
			caption: "vs previous month",
			positiveIsGood: false,
		});
		expect(d?.caption).toBe("vs previous month");
		expect(d?.positiveIsGood).toBe(false);
	});

	it("returns undefined with fewer than two periods or a zero base", () => {
		expect(computePeriodDelta([{ period: "2025-12", total: 1 }], "period", "total")).toBeUndefined();
		expect(
			computePeriodDelta(
				[
					{ period: "2025-12", total: 5 },
					{ period: "2025-11", total: 0 },
				],
				"period",
				"total",
			),
		).toBeUndefined();
	});
});
