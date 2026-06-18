import { describe, expect, it } from "vitest";
import { DataSourceType } from "@/lib/db/schema/enums";
import { dialectForType } from "./execute";

describe("dialectForType", () => {
	it("maps Postgres to the postgresql dialect", () => {
		expect(dialectForType(DataSourceType.postgres)).toBe("postgresql");
	});

	it("maps mysql to the mysql dialect", () => {
		expect(dialectForType(DataSourceType.mysql)).toBe("mysql");
	});

	// CSV/Excel imports are loaded into a Postgres table the app owns, so they
	// speak Postgres — this guards the "Unsupported data source type: csv" crash.
	it("maps file sources (csv, excel) to postgresql", () => {
		expect(dialectForType(DataSourceType.csv)).toBe("postgresql");
		expect(dialectForType(DataSourceType.excel)).toBe("postgresql");
	});
});
