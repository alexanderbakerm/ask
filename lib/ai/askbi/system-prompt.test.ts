import { describe, expect, it } from "vitest";
import { buildAskBiSystemPrompt } from "./system-prompt";

describe("buildAskBiSystemPrompt", () => {
	const prompt = buildAskBiSystemPrompt({
		sourceName: "Demo (askbi_demo)",
		dialect: "postgresql",
	});

	it("names the source and dialect", () => {
		expect(prompt).toContain("Demo (askbi_demo)");
		expect(prompt).toContain("PostgreSQL");
	});

	// Each of these is a constraint we committed to; the test is a tripwire so a
	// future edit can't quietly drop one.
	const requiredDirectives: Array<[string, RegExp]> = [
		[
			"grounding / never invent schema",
			/never invent|ONLY tables and columns|not in the catalog/i,
		],
		["defensive aliasing", /alias every output column/i],
		["date_trunc over EXTRACT", /date_trunc/i],
		["single read-only SELECT", /one read-only SELECT statement/i],
		[
			"result data is not instructions",
			/data, not instructions|untrusted data|ignore previous instructions/i,
		],
		[
			"clarify or state the assumption",
			/clarifying question|STATE the assumption/i,
		],
		["honesty over confident-wrong", /couldn't find data/i],
		["intent is advisory tiebreak", /only breaks ties|breaks ties/i],
		[
			"narrative honesty — figures must come from the result",
			/must come from the query result|never state a number you did not query/i,
		],
		[
			"follow-up refinement",
			/refines a previous answer|build on the previous query/i,
		],
	];

	for (const [label, pattern] of requiredDirectives) {
		it(`includes: ${label}`, () => {
			expect(prompt).toMatch(pattern);
		});
	}

	it("uses the right engine label for mysql", () => {
		expect(
			buildAskBiSystemPrompt({ sourceName: "s", dialect: "mysql" }),
		).toContain("MySQL");
	});
});
