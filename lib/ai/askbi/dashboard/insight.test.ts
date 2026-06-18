import { describe, expect, it } from "vitest";
import type { AskBiAnswer, VizSpec, VizType } from "../viz/spec";
import { computeInsight } from "./insight";

function answer(
	type: VizType,
	encoding: VizSpec["encoding"],
	data: Record<string, unknown>[],
	columns: VizSpec["columns"] = [],
): AskBiAnswer {
	return {
		primary: {
			type,
			title: "t",
			encoding,
			columns,
			data,
			meta: { sql: "", rowCount: data.length, truncated: false },
		},
	};
}

const month = (k: string) => ({
	key: k,
	label: k,
	role: "time" as const,
	dataType: "datetime" as const,
});
const measure = (k: string) => ({
	key: k,
	label: k,
	role: "measure" as const,
	dataType: "number" as const,
});
const dim = (k: string) => ({
	key: k,
	label: k,
	role: "dimension" as const,
	dataType: "string" as const,
});

describe("computeInsight", () => {
	it("trend → percentage change over the period", () => {
		const a = answer(
			"line",
			{ x: month("month"), y: [measure("revenue")] },
			[
				{ month: "2025-01", revenue: 100 },
				{ month: "2025-02", revenue: 134 },
			],
			[
				{
					key: "revenue",
					label: "revenue",
					dataType: "number",
					format: "currency",
				},
			],
		);
		const s = computeInsight(a);
		expect(s).toContain("up 34%");
		expect(s).toContain("$134");
	});

	it("trend → 'down' when declining", () => {
		const a = answer("area", { x: month("m"), y: [measure("revenue")] }, [
			{ m: "1", revenue: 200 },
			{ m: "2", revenue: 150 },
		]);
		expect(computeInsight(a)).toContain("down 25%");
	});

	it("trend → steady when flat", () => {
		const a = answer("line", { x: month("m"), y: [measure("revenue")] }, [
			{ m: "1", revenue: 100 },
			{ m: "2", revenue: 101 },
		]);
		expect(computeInsight(a)?.toLowerCase()).toContain("steady");
	});

	it("breakdown → top category + share of total", () => {
		const a = answer("bar", { x: dim("category"), y: [measure("revenue")] }, [
			{ category: "Hardware", revenue: 800 },
			{ category: "Software", revenue: 150 },
			{ category: "Accessories", revenue: 50 },
		]);
		const s = computeInsight(a);
		expect(s).toContain("Hardware leads");
		expect(s).toContain("80%");
	});

	it("distribution → median + interquartile spread", () => {
		const a = answer(
			"histogram",
			{ value: measure("amount") },
			Array.from({ length: 5 }, (_, i) => ({ amount: i + 1 })),
		);
		expect(computeInsight(a)?.toLowerCase()).toContain("median");
	});

	it("returns undefined for KPI and empty data", () => {
		expect(
			computeInsight(answer("kpi", { value: measure("x") }, [{ x: 1 }])),
		).toBeUndefined();
		expect(
			computeInsight(answer("bar", { x: dim("c"), y: [measure("v")] }, [])),
		).toBeUndefined();
	});
});
