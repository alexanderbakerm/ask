/**
 * Wrap a validated SELECT in a bounded outer query.
 *
 *   SELECT * FROM (<sql>) AS _askbi_q LIMIT n
 *
 * This is the safe row-cap envelope:
 * - it caps the row count regardless of what the inner query does, and
 * - it CLAMPS (never amplifies) a pre-existing inner LIMIT: the inner limit
 *   runs first and the outer only ever returns fewer rows, so there is no
 *   harmful double-application. (Inner LIMIT 5 + cap 1000 → 5 rows; inner
 *   LIMIT 5000 + cap 1000 → 1000 rows.)
 *
 * Callers pass `n = maxRows + 1` and fetch one extra row so they can report
 * `truncated: true` honestly instead of presenting a partial answer as
 * complete.
 *
 * Pure (no DB / env), unit-testable in isolation. The SQL passed here MUST
 * already have been validated as a single read-only SELECT.
 */
export function wrapWithRowLimit(sql: string, limit: number): string {
	// Strip a single trailing semicolon/whitespace so the subquery is valid.
	const inner = sql.trim().replace(/;\s*$/, "").trim();
	const safeLimit = Math.max(1, Math.floor(limit));
	// The newline before `)` ensures a trailing line comment (`-- ...`) inside
	// `inner` cannot comment out the closing parenthesis.
	return `SELECT * FROM (\n${inner}\n) AS _askbi_q\nLIMIT ${safeLimit}`;
}
