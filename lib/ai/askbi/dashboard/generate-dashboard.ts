import "server-only";

import type { DataSourceRow } from "@/lib/datasources/service";
import { executeAskBiQuery } from "../execute";
import { loadSourceCatalog } from "../tools";
import { chooseViz } from "../viz/choose-viz";
import type { AskBiAnswer, KpiDelta } from "../viz/spec";
import { computePeriodDelta } from "./delta";
import { computeInsight } from "./insight";
import { type DashboardTileSpec, planDashboard } from "./plan-dashboard";

/**
 * Server glue between the pure dashboard planner and the execute chokepoint.
 *
 * `planTilesForSource` loads the source's persisted catalog and plans tiles
 * (deterministic, no LLM). `runTile` runs ONE tile's SQL through the same
 * `executeAskBiQuery` chokepoint every AskBI query uses (SELECT-only AST +
 * catalog grounding + read-only tx + injected LIMIT + `query_run` audit) and
 * turns the result into a deterministic chart via `chooseViz`. No credits are
 * consumed (no model call) — auto-dashboards are free apart from the read-only
 * queries themselves.
 */

export async function planTilesForSource(
	dataSource: DataSourceRow,
): Promise<DashboardTileSpec[]> {
	const catalog = await loadSourceCatalog(dataSource.id);
	return planDashboard(catalog);
}

export interface TileResult {
	answer?: AskBiAnswer;
	/** A data-derived one-sentence insight (e.g. "Revenue is up 34%…"). */
	insight?: string;
	/** Sanitized failure message; never raw connector detail. */
	error?: string;
}

export async function runTile(
	dataSource: DataSourceRow,
	spec: DashboardTileSpec,
): Promise<TileResult> {
	const result = await executeAskBiQuery({
		dataSource,
		sql: spec.sql,
		question: spec.title,
	});
	if (result.status !== "success") {
		return { error: result.error };
	}
	const answer = chooseViz({
		columns: result.columns,
		rows: result.rows,
		sql: spec.sql,
		truncated: result.truncated,
		title: spec.title,
		roleHints: result.outputRoles,
	});

	// KPI scorecards get a period-over-period delta from a second cheap read
	// (same chokepoint). Failure is non-fatal — the card just renders without a
	// chip rather than blanking the tile.
	if (spec.kind === "kpi" && spec.deltaSql) {
		const delta = await runDelta(dataSource, spec);
		if (delta) applyDelta(answer, delta);
	}

	return { answer, insight: computeInsight(answer) };
}

async function runDelta(
	dataSource: DataSourceRow,
	spec: DashboardTileSpec,
): Promise<KpiDelta | undefined> {
	if (!spec.deltaSql) return undefined;
	const result = await executeAskBiQuery({
		dataSource,
		sql: spec.deltaSql,
		question: spec.title,
	});
	if (result.status !== "success" || result.columns.length < 2) return undefined;
	const periodKey = result.columns[0]?.name;
	const valueKey = result.columns[1]?.name;
	if (!periodKey || !valueKey) return undefined;
	return computePeriodDelta(result.rows, periodKey, valueKey, {
		caption: spec.deltaCaption,
		positiveIsGood: spec.positiveIsGood,
	});
}

/** Attach the delta to the scorecard (kpi + kpis[0] share the same object). */
function applyDelta(answer: AskBiAnswer, delta: KpiDelta): void {
	if (answer.kpis?.[0]) answer.kpis[0].delta = delta;
	if (answer.kpi) answer.kpi.delta = delta;
}
