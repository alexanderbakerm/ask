import { describe, expect, it } from "vitest";
import { normalizePgType } from "./type-mapping";

describe("normalizePgType", () => {
	const cases: Array<[string, string]> = [
		["integer", "number"],
		["bigint", "number"],
		["smallint", "number"],
		["numeric", "number"],
		["numeric(10,2)", "number"],
		["double precision", "number"],
		["real", "number"],
		["money", "number"],
		["boolean", "boolean"],
		["date", "date"],
		["timestamp without time zone", "datetime"],
		["timestamp with time zone", "datetime"],
		["time without time zone", "time"],
		["json", "json"],
		["jsonb", "json"],
		["character varying", "string"],
		["character varying(255)", "string"],
		["text", "string"],
		["uuid", "string"],
		["USER-DEFINED", "string"],
		["ARRAY", "string"],
		["bytea", "unknown"],
		["point", "unknown"],
	];

	for (const [input, expected] of cases) {
		it(`${input} → ${expected}`, () => {
			expect(normalizePgType(input)).toBe(expected);
		});
	}
});
