import "server-only";

import type * as React from "react";
import { AskBiAnswerView } from "@/components/ai/askbi/askbi-answer";
import { VizRenderer } from "@/components/ai/askbi/viz-renderer";
import { runTile } from "@/lib/ai/askbi/dashboard/generate-dashboard";
import type { DashboardTileSpec } from "@/lib/ai/askbi/dashboard/plan-dashboard";
import { CARD_CLASS } from "@/lib/ai/askbi/viz/theme";
import type { DataSourceRow } from "@/lib/datasources/service";
import { cn } from "@/lib/utils";

function TileCard({
	title,
	className,
	children,
}: {
	title?: string;
	className?: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className={cn(CARD_CLASS, className)}>
			{title ? <h3 className="mb-3 font-medium text-sm">{title}</h3> : null}
			{children}
		</div>
	);
}

/** Streamed placeholder while a tile's query runs (one per Suspense boundary). */
export function TileSkeleton({
	title,
	compact,
}: {
	title?: string;
	compact?: boolean;
}): React.JSX.Element {
	return (
		<TileCard title={title}>
			<div
				className={cn(
					"animate-pulse rounded-md bg-muted",
					compact ? "h-16" : "h-[300px]",
				)}
			/>
		</TileCard>
	);
}

/**
 * One auto-dashboard tile: runs its query through the chokepoint and renders the
 * deterministic chart. KPIs render as a bare scorecard (self-labeled); charts
 * get a titled card + the SQL disclosure (transparency, like the chat answer).
 * A failed tile degrades to a calm message — one bad query never blanks the page.
 */
export async function DashboardTile({
	dataSource,
	spec,
	colorIndex = 0,
}: {
	dataSource: DataSourceRow;
	spec: DashboardTileSpec;
	/** Position among chart tiles → a distinct palette color per chart. */
	colorIndex?: number;
}): Promise<React.JSX.Element> {
	const { answer, error, insight } = await runTile(dataSource, spec);
	if (!answer || error) {
		return (
			<TileCard title={spec.title}>
				<p className="text-muted-foreground text-sm">
					This metric couldn't be loaded right now.
				</p>
			</TileCard>
		);
	}
	if (spec.kind === "kpi") {
		return <VizRenderer answer={answer} />;
	}
	// Drop the companion total KPI inside chart tiles — it's redundant with the
	// KPI row above, and a dashboard tile should be just the chart + SQL.
	return (
		<TileCard title={spec.title}>
			<AskBiAnswerView
				answer={{ ...answer, kpi: undefined }}
				colorOffset={colorIndex}
				description={insight ?? spec.description}
			/>
		</TileCard>
	);
}
