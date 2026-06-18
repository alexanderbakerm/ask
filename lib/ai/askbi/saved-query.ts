import "server-only";

import type { DataSourceRow } from "@/lib/datasources/service";
import type { savedQueryTable } from "@/lib/db/schema";
import { type ExecuteFailure, executeAskBiQuery } from "./execute";
import { chooseViz } from "./viz/choose-viz";
import type { AskBiAnswer, VizIntent } from "./viz/spec";

export type SavedQueryRow = typeof savedQueryTable.$inferSelect;

export type SavedQueryRender =
	| { ok: true; answer: AskBiAnswer; asOf: string }
	| { ok: false; status: ExecuteFailure["status"]; error: string };

const VIZ_INTENTS = new Set<VizIntent>([
	"trend",
	"comparison",
	"partToWhole",
	"correlation",
	"distribution",
	"detail",
]);

function parseStoredIntent(vizSpec: string | null): VizIntent | undefined {
	if (!vizSpec) return undefined;
	try {
		const parsed = JSON.parse(vizSpec) as { intent?: unknown };
		return typeof parsed.intent === "string" &&
			VIZ_INTENTS.has(parsed.intent as VizIntent)
			? (parsed.intent as VizIntent)
			: undefined;
	} catch {
		return undefined;
	}
}

/** Map an execution failure to an honest, calm message for a reopened query. */
function openFailureMessage(failure: ExecuteFailure): string {
	if (failure.category === "catalog") {
		return "This saved query no longer matches the data source — its schema may have changed since you saved it.";
	}
	if (failure.category === "select_only") {
		return "This saved query is no longer a valid read-only query.";
	}
	if (failure.status === "timeout") {
		return "The saved query took too long to run. Try a narrower version.";
	}
	return failure.error;
}

/**
 * Re-run a saved query for fresh data. A saved query is stored text and gets
 * ZERO trust: it re-rides the entire `execute.ts` chokepoint every open — both
 * validators, read-only transaction, injected limits, and a fresh `query_run`
 * audit row. Re-validation means schema drift (a renamed column, a dropped
 * table) is caught and surfaced honestly rather than executing stale or
 * now-unsafe SQL.
 */
export async function runSavedQuery(
	saved: SavedQueryRow,
	dataSource: DataSourceRow,
): Promise<SavedQueryRender> {
	const result = await executeAskBiQuery({
		dataSource,
		sql: saved.sql,
		question: saved.question ?? undefined,
		userId: saved.userId ?? undefined,
	});

	if (result.status !== "success") {
		return {
			ok: false,
			status: result.status,
			error: openFailureMessage(result),
		};
	}

	const answer = chooseViz({
		columns: result.columns,
		rows: result.rows,
		sql: saved.sql,
		truncated: result.truncated,
		roleHints: result.outputRoles,
		intent: parseStoredIntent(saved.vizSpec),
		title: saved.name,
	});

	return { ok: true, answer, asOf: new Date().toISOString() };
}
