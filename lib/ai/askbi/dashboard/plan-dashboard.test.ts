import { describe, expect, it } from "vitest";
import type { SourceCatalog } from "@/lib/ai/askbi/retrieve-catalog";
import {
	type ValidationCatalog,
	validateSqlAgainstCatalog,
} from "@/lib/ai/askbi/validate-against-catalog";
import { validateReadOnlySql } from "@/lib/ai/askbi/validate-sql";
import { planDashboard } from "./plan-dashboard";

/** Map a SourceCatalog to the shape the catalog validator expects. */
function toValidationCatalog(catalog: SourceCatalog): ValidationCatalog {
	return {
		tables: catalog.tables.map((t) => ({
			schema: t.schema,
			table: t.name,
			columns: t.columns.map((c) => c.name),
		})),
	};
}

function col(
	name: string,
	normalizedType: SourceCatalog["tables"][number]["columns"][number]["normalizedType"],
	extra: Partial<SourceCatalog["tables"][number]["columns"][number]> = {},
) {
	return {
		name,
		dataType: normalizedType,
		normalizedType,
		isNullable: false,
		isPrimaryKey: false,
		...extra,
	};
}

// A representative sales catalog: orders (fact: amount/quantity, a date, FK to
// products) + products (category dimension, unit price).
const salesCatalog: SourceCatalog = {
	tables: [
		{
			schema: "sales",
			name: "orders",
			columns: [
				col("id", "number", { isPrimaryKey: true }),
				col("product_id", "number"),
				col("order_date", "date"),
				col("amount", "number"),
				col("quantity", "number"),
			],
			foreignKeys: [
				{
					column: "product_id",
					referencesSchema: "sales",
					referencesTable: "products",
					referencesColumn: "id",
				},
			],
		},
		{
			schema: "sales",
			name: "products",
			columns: [
				col("id", "number", { isPrimaryKey: true }),
				col("name", "string"),
				col("category", "string", { distinctCount: 3 }),
				col("unit_price", "number"),
			],
			foreignKeys: [],
		},
	],
};

describe("planDashboard", () => {
	const tiles = planDashboard(salesCatalog);

	it("produces a bounded, non-empty set of tiles", () => {
		expect(tiles.length).toBeGreaterThan(2);
		expect(tiles.length).toBeLessThanOrEqual(8);
	});

	it("every tile is a single read-only SELECT", () => {
		for (const t of tiles) {
			expect(t.sql.trimStart().toUpperCase().startsWith("SELECT")).toBe(true);
			expect(t.sql).not.toContain(";");
			expect(/\b(insert|update|delete|drop|alter)\b/i.test(t.sql)).toBe(false);
		}
	});

	it("opens with a headline KPI = total of the money measure", () => {
		const kpi = tiles.find((t) => t.kind === "kpi");
		expect(kpi?.title.toLowerCase()).toContain("total amount");
		expect(kpi?.sql).toContain('SUM(t."amount")');
		expect(kpi?.sql).toContain('FROM "sales"."orders"');
	});

	it("includes a monthly trend for the measure (date column → date_trunc)", () => {
		const trend = tiles.find((t) => t.kind === "trend");
		expect(trend?.title.toLowerCase()).toContain("over time");
		expect(trend?.sql).toContain("date_trunc('month', t.\"order_date\")");
		expect(trend?.sql).toContain("GROUP BY 1 ORDER BY 1");
	});

	it("includes an FK-joined breakdown by the low-cardinality category", () => {
		const bd = tiles.find(
			(t) => t.kind === "breakdown" && /category/i.test(t.title),
		);
		expect(bd).toBeDefined();
		expect(bd?.sql).toContain('JOIN "sales"."products" d');
		expect(bd?.sql).toContain('d."category"');
		expect(bd?.sql).toContain("GROUP BY 1 ORDER BY 2 DESC LIMIT 25");
	});

	it("averages a price measure instead of summing it", () => {
		const priceTile = tiles.find((t) => /unit price/i.test(t.title));
		expect(priceTile?.sql).toContain('AVG(t."unit_price")');
	});

	it("respects the tile cap", () => {
		expect(planDashboard(salesCatalog, { maxTiles: 2 })).toHaveLength(2);
	});

	it("returns nothing when there are no measures to chart", () => {
		const noMeasures: SourceCatalog = {
			tables: [
				{
					schema: "public",
					name: "tags",
					columns: [
						col("id", "number", { isPrimaryKey: true }),
						col("label", "string"),
					],
					foreignKeys: [],
				},
			],
		};
		expect(planDashboard(noMeasures)).toEqual([]);
	});

	it("infers a join when no FK is declared (product_id → products)", () => {
		const noFk: SourceCatalog = {
			tables: [
				{
					schema: "sales",
					name: "orders",
					columns: [
						col("id", "number", { isPrimaryKey: true }),
						col("product_id", "number"),
						col("order_date", "date"),
						col("amount", "number"),
					],
					foreignKeys: [],
				},
				{
					schema: "sales",
					name: "products",
					columns: [
						col("id", "number", { isPrimaryKey: true }),
						col("category", "string", { distinctCount: 3 }),
						col("unit_price", "number"),
					],
					foreignKeys: [],
				},
			],
		};
		const bd = planDashboard(noFk).find(
			(t) => t.kind === "breakdown" && /amount by category/i.test(t.title),
		);
		expect(bd).toBeDefined();
		expect(bd?.sql).toContain('JOIN "sales"."products" d');
		expect(bd?.sql).toContain('t."product_id" = d."id"');
	});

	it("interleaves measures — trends for both amount and quantity", () => {
		const titles = tiles.map((t) => t.title.toLowerCase());
		expect(titles).toContain("amount over time");
		expect(titles).toContain("quantity over time");
	});

	it("caps charts at 5", () => {
		const charts = tiles.filter((t) => t.kind !== "kpi");
		expect(charts.length).toBeGreaterThanOrEqual(1);
		expect(charts.length).toBeLessThanOrEqual(5);
	});

	it("gives every chart a one-sentence description (KPIs have none)", () => {
		for (const t of tiles) {
			if (t.kind === "kpi") {
				expect(t.description).toBeUndefined();
			} else {
				expect(t.description?.length ?? 0).toBeGreaterThan(0);
				expect(t.description?.endsWith(".")).toBe(true);
			}
		}
	});

	it("attaches a period-over-period delta query to KPIs (date source)", () => {
		const kpi = tiles.find((t) => t.kind === "kpi");
		expect(kpi?.deltaSql).toContain("to_char(t.\"order_date\", 'YYYY-MM')");
		expect(kpi?.deltaSql).toContain("ORDER BY 1 DESC LIMIT 2");
		expect(kpi?.deltaCaption).toBe("vs previous month");
		expect(kpi?.positiveIsGood).toBe(true);
	});

	it("flags lower-is-better measures so their delta chip flips color", () => {
		const costCatalog: SourceCatalog = {
			tables: [
				{
					schema: "ops",
					name: "spend",
					columns: [
						col("id", "number", { isPrimaryKey: true }),
						col("spend_date", "date"),
						col("cost", "number"),
					],
					foreignKeys: [],
				},
			],
		};
		const kpi = planDashboard(costCatalog).find((t) => t.kind === "kpi");
		expect(kpi?.positiveIsGood).toBe(false);
	});

	it("emits a heatmap tile (dimension × month) for the primary measure", () => {
		const heat = tiles.find((t) => t.kind === "heatmap");
		expect(heat?.title.toLowerCase()).toContain("and month");
		expect(heat?.sql).toContain("to_char(t.\"order_date\", 'YYYY-MM')");
		expect(heat?.sql).toContain('JOIN "sales"."products" d');
		expect(heat?.sql).toContain("GROUP BY 1, 2 ORDER BY 1, 2");
	});

	it("sizes charts two-up: KPIs sm, heatmap full, others half, no lone tile", () => {
		for (const t of tiles) {
			expect(t.tileSize).toBeDefined();
			if (t.kind === "kpi") expect(t.tileSize).toBe("sm");
		}
		const charts = tiles.filter((t) => t.kind !== "kpi");
		// The heatmap spans the row; line/bar charts pair up half-width.
		expect(charts.find((t) => t.kind === "heatmap")?.tileSize).toBe("full");
		// An even number of half-width tiles → rows pack cleanly (no lone "md").
		const md = charts.filter((c) => c.tileSize === "md").length;
		expect(md % 2).toBe(0);
	});

	// The bug we never want again: a planned query the chokepoint then rejects
	// (e.g. the historical `ORDER BY ... DESC`). Every tile's SQL — including the
	// KPI delta query — must pass BOTH validators it will face at runtime.
	it("every planned SQL passes the read-only + catalog validators", () => {
		const validationCatalog = toValidationCatalog(salesCatalog);
		for (const t of tiles) {
			for (const sql of [t.sql, t.deltaSql].filter((s): s is string => !!s)) {
				expect(validateReadOnlySql(sql, "postgresql").ok).toBe(true);
				expect(
					validateSqlAgainstCatalog(sql, validationCatalog, "postgresql").ok,
				).toBe(true);
			}
		}
	});
});
