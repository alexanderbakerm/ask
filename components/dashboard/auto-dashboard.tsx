import "server-only";

import type * as React from "react";
import { Suspense } from "react";
import { planTilesForSource } from "@/lib/ai/askbi/dashboard/generate-dashboard";
import type { TileSize } from "@/lib/ai/askbi/viz/spec";
import type { DataSourceRow } from "@/lib/datasources/service";
import { cn } from "@/lib/utils";
import { DashboardTile, TileSkeleton } from "./dashboard-tile";

// Tile footprint → column span. The grids use CONTAINER queries (@container),
// so the 2-up split keys off the dashboard's own width, not the viewport — the
// fixed-width sidebar no longer collapses everything to a single column.
const SPAN: Record<TileSize, string> = {
	sm: "",
	md: "",
	lg: "@2xl:col-span-2",
	full: "@2xl:col-span-2",
};

/** Loading state for the whole dashboard (before tiles are even planned). */
export function DashboardSkeleton(): React.JSX.Element {
	return (
		<div className="@container space-y-5">
			<div className="grid grid-cols-2 gap-5 @2xl:grid-cols-4">
				{[0, 1, 2, 3].map((i) => (
					<TileSkeleton key={i} compact />
				))}
			</div>
			<div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
				{[0, 1, 2, 3].map((i) => (
					<TileSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

/**
 * The auto-generated data hub. Plans tiles from the source's catalog, then
 * streams each tile independently (its own Suspense boundary) so KPIs and charts
 * pop in as their queries finish. KPIs sit in a compact top row; charts flow
 * into a responsive 12-column grid where the planner-assigned `tileSize` decides
 * each tile's footprint (full-width hero + heatmap, half-width breakdowns).
 */
export async function AutoDashboard({
	dataSource,
}: {
	dataSource: DataSourceRow;
}): Promise<React.JSX.Element> {
	const specs = await planTilesForSource(dataSource);

	if (specs.length === 0) {
		return (
			<div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
				<p>
					Connected to{" "}
					<span className="font-medium text-foreground">{dataSource.name}</span>
					, but we didn't find numeric metrics to chart yet.
				</p>
				<p className="mt-1">
					Ask a question in the AI Chatbot to explore this source.
				</p>
			</div>
		);
	}

	const kpis = specs.filter((s) => s.kind === "kpi");
	const charts = specs.filter((s) => s.kind !== "kpi");

	return (
		<div className="@container space-y-5">
			{kpis.length > 0 && (
				<div className="grid grid-cols-2 gap-5 @2xl:grid-cols-4">
					{kpis.map((spec) => (
						<Suspense
							key={spec.title}
							fallback={<TileSkeleton title={spec.title} compact />}
						>
							<DashboardTile dataSource={dataSource} spec={spec} />
						</Suspense>
					))}
				</div>
			)}
			{charts.length > 0 && (
				<div className="grid grid-cols-1 gap-5 @2xl:grid-flow-row-dense @2xl:grid-cols-2">
					{charts.map((spec, i) => (
						<div key={spec.title} className={cn(SPAN[spec.tileSize ?? "md"])}>
							<Suspense fallback={<TileSkeleton title={spec.title} />}>
								<DashboardTile
									dataSource={dataSource}
									spec={spec}
									colorIndex={i}
								/>
							</Suspense>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
