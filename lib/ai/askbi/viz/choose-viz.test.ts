import { describe, expect, it } from "vitest";
import { type ChooseVizInput, chooseViz } from "./choose-viz";

function input(
	columns: string[],
	rows: Record<string, unknown>[],
	extra: Partial<ChooseVizInput> = {},
): ChooseVizInput {
	return {
		columns: columns.map((name) => ({ name })),
		rows,
		sql: "SELECT 1",
		truncated: false,
		...extra,
	};
}

describe("chooseViz — KPI", () => {
	it("single aggregate number → kpi (+ currency format)", () => {
		const answer = chooseViz(
			input(["total_revenue"], [{ total_revenue: 98765 }]),
		);
		expect(answer.primary.type).toBe("kpi");
		expect(answer.primary.encoding.value?.key).toBe("total_revenue");
		expect(answer.kpi?.value).toBe(98765);
		expect(answer.kpi?.format).toBe("currency");
		// Single measure → exactly one scorecard.
		expect(answer.kpis).toHaveLength(1);
	});

	it("single time bucket (one row) → scorecards, never a 1-point line", () => {
		const answer = chooseViz(
			input(
				["sales_year", "total_sales_amount", "total_quantity_sold"],
				[
					{
						sales_year: "2025-01-01T08:00:00.000Z",
						total_sales_amount: "63571.20",
						total_quantity_sold: "36",
					},
				],
				{
					roleHints: {
						sales_year: "time",
						total_sales_amount: "measure",
						total_quantity_sold: "measure",
					},
				},
			),
		);
		expect(answer.primary.type).toBe("kpi");
		expect(answer.kpis?.map((k) => k.label)).toEqual([
			"Total sales amount",
			"Total quantity sold",
		]);
		expect(answer.kpis?.[0]?.value).toBeCloseTo(63571.2);
		expect(answer.kpis?.[0]?.format).toBe("currency");
		// "total_quantity_sold" contains "total" but is a count → number, not money.
		expect(answer.kpis?.[1]?.format).toBe("number");
	});

	it("multi-measure single aggregate → one scorecard per measure", () => {
		const answer = chooseViz(
			input(
				["total_revenue", "order_count"],
				[{ total_revenue: 98765, order_count: 1200 }],
			),
		);
		expect(answer.primary.type).toBe("kpi");
		expect(answer.kpis).toHaveLength(2);
		expect(answer.kpis?.[0]?.format).toBe("currency");
		expect(answer.kpis?.[1]?.format).toBe("number");
	});

	it("single row with one dimension + measure → scorecard (not a 1-bar bar)", () => {
		const answer = chooseViz(
			input(["category", "revenue"], [{ category: "Hardware", revenue: 1000 }]),
		);
		expect(answer.primary.type).toBe("kpi");
		expect(answer.kpis).toHaveLength(1);
	});
});

describe("chooseViz — line (time series)", () => {
	const rows = [
		{ month: "2025-10-01", revenue: 100 },
		{ month: "2025-11-01", revenue: 160 },
		{ month: "2025-12-01", revenue: 240 },
	];

	it("time + measure → line, with a total KPI companion", () => {
		const answer = chooseViz(input(["month", "revenue"], rows));
		expect(answer.primary.type).toBe("line");
		expect(answer.primary.encoding.x?.key).toBe("month");
		expect(answer.primary.encoding.y?.map((f) => f.key)).toEqual(["revenue"]);
		expect(answer.kpi?.value).toBe(500);
	});

	it("omits the KPI companion when the result is truncated", () => {
		const answer = chooseViz(
			input(["month", "revenue"], rows, { truncated: true }),
		);
		expect(answer.primary.type).toBe("line");
		expect(answer.kpi).toBeUndefined();
		expect(answer.primary.meta.truncated).toBe(true);
	});

	it("time + dimension + measure → line with a series", () => {
		const answer = chooseViz(
			input("month,region,revenue".split(","), [
				{ month: "2025-10-01", region: "EU", revenue: 10 },
				{ month: "2025-11-01", region: "EU", revenue: 20 },
			]),
		);
		expect(answer.primary.type).toBe("line");
		expect(answer.primary.encoding.series?.key).toBe("region");
	});

	it("part-to-whole over a FEW time buckets → donut by period (honors a pie request)", () => {
		const answer = chooseViz(
			input(["month", "revenue"], rows, { intent: "partToWhole" }),
		);
		// "Q4 by month as a pie" = each month's share of the quarter.
		expect(answer.primary.type).toBe("pie");
		expect(answer.primary.options?.donut).toBe(true);
		expect(answer.primary.encoding.category?.key).toBe("month");
		expect(answer.primary.encoding.value?.key).toBe("revenue");
		// The donut center shows the total, so no separate companion KPI.
		expect(answer.kpi).toBeUndefined();
	});

	it("part-to-whole over MANY time buckets stays a line (a pie would be unreadable)", () => {
		const many = Array.from({ length: 12 }, (_, i) => ({
			month: `2025-${String(i + 1).padStart(2, "0")}-01`,
			revenue: i + 1,
		}));
		const answer = chooseViz(
			input(["month", "revenue"], many, { intent: "partToWhole" }),
		);
		expect(answer.primary.type).toBe("line");
	});

	it("default (no intent) single-measure time series stays a line", () => {
		const answer = chooseViz(input(["month", "revenue"], rows));
		expect(answer.primary.type).toBe("line");
	});

	it("never reorders a time series — chronological order is preserved", () => {
		const answer = chooseViz(input(["month", "revenue"], rows));
		expect(answer.primary.data.map((r) => r.month)).toEqual([
			"2025-10-01",
			"2025-11-01",
			"2025-12-01",
		]);
	});

	it("dual-scale time + amount + quantity → combo (bars + line)", () => {
		const monthly = [
			{
				month: "2025-10-01",
				total_sales_amount: 5520,
				total_quantity_sold: 11,
			},
			{
				month: "2025-11-01",
				total_sales_amount: 11040,
				total_quantity_sold: 13,
			},
			{
				month: "2025-12-01",
				total_sales_amount: 20217.6,
				total_quantity_sold: 13,
			},
		];
		const answer = chooseViz(
			input(["month", "total_sales_amount", "total_quantity_sold"], monthly, {
				roleHints: {
					month: "time",
					total_sales_amount: "measure",
					total_quantity_sold: "measure",
				},
			}),
		);
		expect(answer.primary.type).toBe("combo");
		expect(answer.primary.encoding.x?.key).toBe("month");
		expect(answer.primary.encoding.y?.map((f) => f.key)).toEqual([
			"total_sales_amount",
		]);
		expect(answer.primary.encoding.yRight?.map((f) => f.key)).toEqual([
			"total_quantity_sold",
		]);
		// Two measures → no misleading partial-total KPI.
		expect(answer.kpi).toBeUndefined();
	});

	it("similar-scale measures stay a line (no unnecessary dual axis)", () => {
		const answer = chooseViz(
			input(
				["month", "revenue", "cost"],
				[
					{ month: "2025-10-01", revenue: 100, cost: 80 },
					{ month: "2025-11-01", revenue: 160, cost: 120 },
				],
			),
		);
		expect(answer.primary.type).toBe("line");
		expect(answer.primary.encoding.yRight).toBeUndefined();
	});
});

describe("chooseViz — bar vs pie (1 dimension + 1 measure)", () => {
	const rows = [
		{ category: "Hardware", revenue: 300 },
		{ category: "Software", revenue: 200 },
		{ category: "Accessories", revenue: 60 },
	];

	it("defaults to bar without part-to-whole intent", () => {
		const answer = chooseViz(input(["category", "revenue"], rows));
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.encoding.x?.key).toBe("category");
		expect(answer.kpi?.value).toBe(560);
	});

	it("ranks a categorical bar by measure, descending (BI default)", () => {
		const unsorted = [
			{ category: "A", revenue: 50 },
			{ category: "B", revenue: 300 },
			{ category: "C", revenue: 120 },
		];
		const answer = chooseViz(input(["category", "revenue"], unsorted));
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.data.map((r) => r.category)).toEqual(["B", "C", "A"]);
	});

	it("ranks pie slices by value, descending (nominal category)", () => {
		const unsorted = [
			{ category: "A", revenue: 50 },
			{ category: "B", revenue: 300 },
			{ category: "C", revenue: 120 },
		];
		const answer = chooseViz(
			input(["category", "revenue"], unsorted, { intent: "partToWhole" }),
		);
		expect(answer.primary.type).toBe("pie");
		expect(answer.primary.data.map((r) => r.category)).toEqual(["B", "C", "A"]);
	});

	it("adds an average reference line to a single-measure bar (>=3 bars)", () => {
		const answer = chooseViz(
			input(
				["category", "revenue"],
				[
					{ category: "A", revenue: 100 },
					{ category: "B", revenue: 200 },
					{ category: "C", revenue: 300 },
				],
			),
		);
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.options?.referenceLine?.value).toBe(200);
		expect(answer.primary.options?.referenceLine?.label).toBe("Avg");
	});

	it("shows only the top 15 bars for a crowded ranked result, with a disclosure note", () => {
		const many = Array.from({ length: 23 }, (_, i) => ({
			category: `Customer ${i}`,
			revenue: (i + 1) * 10,
		}));
		const answer = chooseViz(input(["category", "revenue"], many));
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.data).toHaveLength(15);
		// Ranked desc → the largest (230) is first.
		expect(answer.primary.data[0]?.revenue).toBe(230);
		expect(answer.primary.meta.notes?.[0]).toContain("Top 15 of 23");
		// rowCount still reflects the full result, not the shown slice.
		expect(answer.primary.meta.rowCount).toBe(23);
	});

	it("does not truncate or note when categories are within the limit", () => {
		const fifteen = Array.from({ length: 15 }, (_, i) => ({
			category: `C${i}`,
			revenue: i + 1,
		}));
		const answer = chooseViz(input(["category", "revenue"], fifteen));
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.data).toHaveLength(15);
		expect(answer.primary.meta.notes).toBeUndefined();
	});

	it("no average line for fewer than 3 bars", () => {
		const answer = chooseViz(
			input(
				["category", "revenue"],
				[
					{ category: "A", revenue: 100 },
					{ category: "B", revenue: 200 },
				],
			),
		);
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.options?.referenceLine).toBeUndefined();
	});

	it("does NOT reorder a numeric/ordinal dimension bar (keeps natural order)", () => {
		const answer = chooseViz(
			input(
				["bucket", "n"],
				[
					{ bucket: 1, n: 10 },
					{ bucket: 2, n: 99 },
					{ bucket: 3, n: 50 },
				],
				{ roleHints: { bucket: "dimension", n: "measure" } },
			),
		);
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.data.map((r) => r.bucket)).toEqual([1, 2, 3]);
	});

	it("chooses pie only with part-to-whole intent and few slices", () => {
		const answer = chooseViz(
			input(["category", "revenue"], rows, { intent: "partToWhole" }),
		);
		expect(answer.primary.type).toBe("pie");
		expect(answer.primary.encoding.category?.key).toBe("category");
		expect(answer.primary.encoding.value?.key).toBe("revenue");
		// Pie renders as a donut (center total) by default; the type stays "pie".
		expect(answer.primary.options?.donut).toBe(true);
		// The donut center shows the total, so no redundant companion KPI card.
		expect(answer.kpi).toBeUndefined();
	});

	it("uses the REAL distinct count from rows — many categories never become a pie", () => {
		const many = Array.from({ length: 12 }, (_, i) => ({
			category: `C${i}`,
			revenue: i + 1,
		}));
		const answer = chooseViz(
			input(["category", "revenue"], many, { intent: "partToWhole" }),
		);
		expect(answer.primary.type).toBe("bar");
	});

	it("flags horizontal for long category labels", () => {
		const longLabels = [
			{ category: "An extremely long category label here", revenue: 1 },
			{ category: "Another very long category label", revenue: 2 },
		];
		const answer = chooseViz(input(["category", "revenue"], longLabels));
		expect(answer.primary.options?.horizontal).toBe(true);
	});
});

describe("chooseViz — scatter & grouped bar", () => {
	it("two measures, no dimension → scatter", () => {
		const answer = chooseViz(
			input(
				["spend", "conversions"],
				[
					{ spend: 10, conversions: 2 },
					{ spend: 20, conversions: 5 },
				],
			),
		);
		expect(answer.primary.type).toBe("scatter");
		expect(answer.primary.encoding.x?.key).toBe("spend");
		expect(answer.primary.encoding.y?.map((f) => f.key)).toEqual([
			"conversions",
		]);
	});

	it("two dimensions + one measure → grouped bar (stacked with part-to-whole)", () => {
		const rows = [
			{ region: "EU", category: "HW", revenue: 5 },
			{ region: "US", category: "SW", revenue: 9 },
		];
		expect(
			chooseViz(input("region,category,revenue".split(","), rows)).primary.type,
		).toBe("groupedBar");
		expect(
			chooseViz(
				input("region,category,revenue".split(","), rows, {
					intent: "partToWhole",
				}),
			).primary.type,
		).toBe("stackedBar");
	});

	it("two dimensions that form a real matrix → heatmap (x, y, value encoded)", () => {
		// 4 months × 3 categories = a 12-cell matrix → heatmap beats clustered bars.
		// `period` carries month text (a string dimension), the way the planner's
		// `to_char(...) AS period` does — NOT a column named "month" (a time axis).
		const periods = ["2025-01", "2025-02", "2025-03", "2025-04"];
		const cats = ["HW", "SW", "AC"];
		const rows = periods.flatMap((period) =>
			cats.map((category, i) => ({ period, category, revenue: 10 + i })),
		);
		const answer = chooseViz(input(["period", "category", "revenue"], rows));
		expect(answer.primary.type).toBe("heatmap");
		expect(answer.primary.encoding.x?.key).toBe("period");
		expect(answer.primary.encoding.series?.key).toBe("category");
		expect(answer.primary.encoding.value?.key).toBe("revenue");
	});

	it("part-to-whole over two dimensions stays a stacked bar (not a heatmap)", () => {
		const periods = ["2025-01", "2025-02", "2025-03", "2025-04"];
		const cats = ["HW", "SW", "AC"];
		const rows = periods.flatMap((period) =>
			cats.map((category, i) => ({ period, category, revenue: 10 + i })),
		);
		expect(
			chooseViz(
				input(["period", "category", "revenue"], rows, {
					intent: "partToWhole",
				}),
			).primary.type,
		).toBe("stackedBar");
	});
});

describe("chooseViz — table fallback (never a guessed chart)", () => {
	it("no measure → table", () => {
		const answer = chooseViz(
			input(["category"], [{ category: "A" }, { category: "B" }]),
		);
		expect(answer.primary.type).toBe("table");
	});

	it("three dimensions + measure → table", () => {
		const answer = chooseViz(
			input("a,b,c,m".split(","), [{ a: "1", b: "2", c: "3", m: 4 }]),
		);
		expect(answer.primary.type).toBe("table");
	});

	it("empty result → table", () => {
		const answer = chooseViz(input(["month", "revenue"], []));
		expect(answer.primary.type).toBe("table");
	});
});

describe("chooseViz — value coercion", () => {
	it("treats numeric strings (pg numeric) as measures and sums them", () => {
		const answer = chooseViz(
			input(
				["category", "amount"],
				[
					{ category: "A", amount: "10.50" },
					{ category: "B", amount: "4.50" },
				],
			),
		);
		expect(answer.primary.type).toBe("bar");
		expect(answer.kpi?.value).toBe(15);
	});

	it("treats Date objects as a time axis", () => {
		const answer = chooseViz(
			input(
				["day", "n"],
				[
					{ day: new Date("2025-10-01"), n: 1 },
					{ day: new Date("2025-10-02"), n: 2 },
				],
			),
		);
		expect(answer.primary.type).toBe("line");
	});
});

describe("chooseViz — role resolution (structure → name → value)", () => {
	it("authoritative roleHint makes a numeric month a time axis (→ line)", () => {
		const answer = chooseViz(
			input(
				["month", "revenue"],
				[
					{ month: 10, revenue: 100 },
					{ month: 11, revenue: 160 },
					{ month: 12, revenue: 240 },
				],
				{ roleHints: { month: "time", revenue: "measure" } },
			),
		);
		expect(answer.primary.type).toBe("line");
		expect(answer.primary.encoding.x?.key).toBe("month");
	});

	it("name heuristic keeps a numeric month as time without a hint", () => {
		const answer = chooseViz(
			input(
				["month", "revenue"],
				[
					{ month: 10, revenue: 1 },
					{ month: 11, revenue: 2 },
				],
			),
		);
		expect(answer.primary.type).toBe("line");
	});

	it("name heuristic keeps a numeric *_id as a dimension (→ bar, not scatter)", () => {
		const answer = chooseViz(
			input(
				["product_id", "revenue"],
				[
					{ product_id: 1, revenue: 5 },
					{ product_id: 2, revenue: 9 },
				],
			),
		);
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.encoding.x?.key).toBe("product_id");
	});

	it("roleHint overrides value inference (numeric treated as dimension)", () => {
		const answer = chooseViz(
			input(
				["bucket", "n"],
				[
					{ bucket: 1, n: 10 },
					{ bucket: 2, n: 20 },
				],
				{ roleHints: { bucket: "dimension", n: "measure" } },
			),
		);
		expect(answer.primary.type).toBe("bar");
		expect(answer.primary.encoding.x?.key).toBe("bucket");
	});
});

describe("chooseViz — intent round-trips (for saved-query reopen)", () => {
	it("echoes the provided intent onto the answer", () => {
		const answer = chooseViz(
			input(["category", "revenue"], [{ category: "A", revenue: 1 }], {
				intent: "partToWhole",
			}),
		);
		expect(answer.intent).toBe("partToWhole");
	});

	it("leaves intent undefined when none was provided", () => {
		const answer = chooseViz(
			input(["category", "revenue"], [{ category: "A", revenue: 1 }]),
		);
		expect(answer.intent).toBeUndefined();
	});
});

describe("chooseViz — column formats (for the formatted table)", () => {
	it("annotates measure columns money vs count; leaves dimensions/ids unformatted", () => {
		const answer = chooseViz(
			input("region,product_id,amount,units".split(","), [
				{ region: "EU", product_id: 1, amount: "10.50", units: 3 },
				{ region: "US", product_id: 2, amount: "4.50", units: 1 },
				{ region: "EU", product_id: 1, amount: "2.00", units: 5 },
			]),
		);
		// Two dimensions + two measures → no clean chart → detail table.
		expect(answer.primary.type).toBe("table");
		const fmt = Object.fromEntries(
			answer.primary.columns.map((c) => [c.key, c.format]),
		);
		expect(fmt.amount).toBe("currency");
		// "units" is a count even though it's numeric → plain number, not money.
		expect(fmt.units).toBe("number");
		// Dimensions (incl. numeric *_id) carry no format.
		expect(fmt.region).toBeUndefined();
		expect(fmt.product_id).toBeUndefined();
	});

	it("carries date dataType + currency format through to a detail table", () => {
		const answer = chooseViz(
			input("order_date,region,channel,amount".split(","), [
				{
					order_date: "2025-10-01",
					region: "EU",
					channel: "web",
					amount: "10.50",
				},
				{
					order_date: "2025-11-01",
					region: "US",
					channel: "store",
					amount: "4.50",
				},
			]),
		);
		// 1 time + 2 dimensions + 1 measure → no clean chart → detail table.
		expect(answer.primary.type).toBe("table");
		const cols = Object.fromEntries(
			answer.primary.columns.map((c) => [c.key, c]),
		);
		expect(cols.order_date?.dataType).toBe("datetime");
		expect(cols.amount?.format).toBe("currency");
		expect(cols.region?.format).toBeUndefined();
	});
});

describe("chooseViz — expanded chart catalog", () => {
	it("part-to-whole over time + a series → stacked area (composition)", () => {
		const answer = chooseViz(
			input(
				"month,region,revenue".split(","),
				[
					{ month: "2025-10-01", region: "EU", revenue: 10 },
					{ month: "2025-10-01", region: "US", revenue: 20 },
					{ month: "2025-11-01", region: "EU", revenue: 15 },
					{ month: "2025-11-01", region: "US", revenue: 25 },
				],
				{ intent: "partToWhole" },
			),
		);
		expect(answer.primary.type).toBe("stackedArea");
		expect(answer.primary.encoding.series?.key).toBe("region");
	});

	it("comparison intent on a categorical measure → dot plot", () => {
		const answer = chooseViz(
			input(
				["category", "revenue"],
				[
					{ category: "A", revenue: 50 },
					{ category: "B", revenue: 300 },
					{ category: "C", revenue: 120 },
				],
				{ intent: "comparison" },
			),
		);
		expect(answer.primary.type).toBe("dotPlot");
		expect(answer.primary.encoding.x?.key).toBe("category");
	});

	it("a single numeric column with many raw rows → histogram", () => {
		const rows = Array.from({ length: 40 }, (_, i) => ({ order_size: i + 1 }));
		const answer = chooseViz(input(["order_size"], rows));
		expect(answer.primary.type).toBe("histogram");
		expect(answer.primary.encoding.value?.key).toBe("order_size");
	});

	it("distribution intent forces a histogram even with few rows (discrete)", () => {
		const answer = chooseViz(
			input(["amount"], [{ amount: 1 }, { amount: 2 }, { amount: 3 }], {
				intent: "distribution",
			}),
		);
		expect(answer.primary.type).toBe("histogram");
	});

	it("distribution intent on a continuous column → density (smooth)", () => {
		const rows = Array.from({ length: 50 }, (_, i) => ({ amount: i + 0.5 }));
		const answer = chooseViz(
			input(["amount"], rows, { intent: "distribution" }),
		);
		expect(answer.primary.type).toBe("density");
		expect(answer.primary.encoding.value?.key).toBe("amount");
	});

	it("distribution intent by category → box plot", () => {
		const rows = [
			{ region: "EU", value: 1 },
			{ region: "EU", value: 3 },
			{ region: "EU", value: 5 },
			{ region: "US", value: 2 },
			{ region: "US", value: 4 },
			{ region: "US", value: 6 },
		];
		const answer = chooseViz(
			input(["region", "value"], rows, { intent: "distribution" }),
		);
		expect(answer.primary.type).toBe("boxplot");
		expect(answer.primary.encoding.x?.key).toBe("region");
	});
});
