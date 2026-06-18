import { describe, expect, it } from "vitest";
import { rankCatalog, type SourceCatalog } from "./retrieve-catalog";

const catalog: SourceCatalog = {
	tables: [
		{
			schema: "sales",
			name: "products",
			columns: [
				{
					name: "id",
					dataType: "integer",
					normalizedType: "number",
					isNullable: false,
					isPrimaryKey: true,
				},
				{
					name: "name",
					dataType: "text",
					normalizedType: "string",
					isNullable: false,
					isPrimaryKey: false,
				},
				{
					name: "category",
					dataType: "text",
					normalizedType: "string",
					isNullable: true,
					isPrimaryKey: false,
					distinctCount: 3,
					sampleValues: ["Hardware", "Software", "Accessories"],
				},
				{
					name: "unit_price",
					dataType: "numeric",
					normalizedType: "number",
					isNullable: false,
					isPrimaryKey: false,
				},
			],
			foreignKeys: [],
		},
		{
			schema: "sales",
			name: "orders",
			columns: [
				{
					name: "id",
					dataType: "integer",
					normalizedType: "number",
					isNullable: false,
					isPrimaryKey: true,
				},
				{
					name: "product_id",
					dataType: "integer",
					normalizedType: "number",
					isNullable: false,
					isPrimaryKey: false,
				},
				{
					name: "order_date",
					dataType: "date",
					normalizedType: "date",
					isNullable: false,
					isPrimaryKey: false,
				},
				{
					name: "amount",
					dataType: "numeric",
					normalizedType: "number",
					isNullable: false,
					isPrimaryKey: false,
				},
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
	],
};

const find = (r: ReturnType<typeof rankCatalog>, name: string) =>
	r.tables.find((t) => t.name === name);

describe("rankCatalog — join reachability (the key behavior)", () => {
	it("a fact-only lexical match still surfaces the FK-linked dimension table", () => {
		// "amount"/"order"/"date" hit orders only; products has none of them.
		const r = rankCatalog(catalog, "total amount by order date");
		expect(find(r, "orders")?.reason).toBe("matched");
		const products = find(r, "products");
		expect(products).toBeDefined(); // pulled in via orders.product_id → products
		expect(products?.reason).toBe("fk-neighbor");
	});

	it("a dimension-only match surfaces the fact table via the incoming FK", () => {
		const r = rankCatalog(catalog, "category breakdown");
		expect(find(r, "products")?.reason).toBe("matched");
		expect(find(r, "orders")?.reason).toBe("fk-neighbor");
	});
});

describe("rankCatalog — recall & weighting", () => {
	it("surfaces the obviously relevant tables for a real question", () => {
		const r = rankCatalog(catalog, "revenue by product category");
		expect(find(r, "products")).toBeDefined();
		expect(find(r, "orders")).toBeDefined();
		expect(r.matchedTableCount).toBeGreaterThanOrEqual(1);
	});

	it("ranks a name match above a sample-only match", () => {
		const r = rankCatalog(catalog, "orders");
		expect(r.tables[0]?.name).toBe("orders");
	});
});

describe("rankCatalog — sample values for filter resolution", () => {
	it("surfaces low-cardinality sample values so the model knows how to filter", () => {
		const r = rankCatalog(catalog, "sales in the Hardware category");
		const products = find(r, "products");
		const category = products?.columns.find((c) => c.name === "category");
		expect(category?.sampleValues).toEqual(
			expect.arrayContaining(["Hardware"]),
		);
	});
});

describe("rankCatalog — grounding miss floor", () => {
	it("returns no matches for an unrelated question", () => {
		const r = rankCatalog(catalog, "weather forecast for tomorrow");
		expect(r.matchedTableCount).toBe(0);
		expect(r.tables).toHaveLength(0);
	});
});
