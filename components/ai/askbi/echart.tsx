"use client";

import {
	BarChart,
	BoxplotChart,
	HeatmapChart,
	LineChart,
	PieChart,
	ScatterChart,
} from "echarts/charts";
import {
	AxisPointerComponent,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TitleComponent,
	TooltipComponent,
	VisualMapComponent,
} from "echarts/components";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type * as React from "react";
import { useEffect, useRef } from "react";

/**
 * Minimal, framework-agnostic ECharts host. ECharts touches the DOM, so it only
 * runs client-side: the div renders on the server, the chart inits in an effect
 * after hydration. A ResizeObserver keeps it responsive; the instance is
 * disposed on unmount. This is the ONLY file that imports the charting library.
 *
 * ECharts is imported MODULARLY — core plus only the series and components AskBI
 * actually renders (no full bundle). The whole module is also code-split via
 * `next/dynamic` at the call site, so it never lands in the initial/server
 * bundle. Add a chart/component here when the renderer starts using a new one.
 */
echarts.use([
	// Series
	BarChart,
	BoxplotChart,
	HeatmapChart,
	LineChart,
	PieChart,
	ScatterChart,
	// Components
	AxisPointerComponent,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TitleComponent,
	TooltipComponent,
	VisualMapComponent,
	// Renderer
	CanvasRenderer,
]);

export function EChart({
	option,
	height = 320,
	className,
}: {
	option: EChartsOption;
	height?: number;
	className?: string;
}): React.JSX.Element {
	const elRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<echarts.ECharts | null>(null);

	// Initialize once, tear down on unmount.
	useEffect(() => {
		const el = elRef.current;
		if (!el) return;
		const chart = echarts.init(el, undefined, { renderer: "canvas" });
		chartRef.current = chart;
		const ro = new ResizeObserver(() => chart.resize());
		ro.observe(el);
		return () => {
			ro.disconnect();
			chart.dispose();
			chartRef.current = null;
		};
	}, []);

	// Re-apply on option change (notMerge so stale series never linger).
	useEffect(() => {
		chartRef.current?.setOption(option, true);
	}, [option]);

	return (
		<div ref={elRef} className={className} style={{ height, width: "100%" }} />
	);
}
