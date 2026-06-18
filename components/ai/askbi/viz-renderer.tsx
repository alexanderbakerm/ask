"use client";

import type { EChartsOption } from "echarts";
import dynamic from "next/dynamic";
import type * as React from "react";
import { useMemo } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	type DateGranularity,
	dateGranularity,
	formatAxisTick,
	formatDate,
	formatHeadline,
	formatMeasure,
} from "@/lib/ai/askbi/viz/format";
import type {
	AskBiAnswer,
	FieldRef,
	KpiDelta,
	KpiSpec,
	VizColumn,
	VizSpec,
} from "@/lib/ai/askbi/viz/spec";
import { histogramBins, kde, quartiles } from "@/lib/ai/askbi/viz/stats";
import {
	areaGradient,
	barGradient,
	CARD_CLASS,
	color,
	heatmapRamp,
	hexToRgba,
	PALETTE,
	type Theme,
	theme,
	tooltipChrome,
} from "@/lib/ai/askbi/viz/theme";
import { cn } from "@/lib/utils";

// The charting library is heavy and client-only, so it's code-split into its
// own chunk and loaded after hydration (never in the server/initial bundle).
const EChart = dynamic(() => import("./echart").then((m) => m.EChart), {
	ssr: false,
	loading: () => (
		<div className="h-[320px] w-full animate-pulse rounded-md bg-muted" />
	),
});

/**
 * The ONLY charting-library-coupled adapter. It consumes the typed `vizSpec`
 * (never raw results, never a re-derived role/threshold — determinism lives in
 * chooseViz) and maps it to an ECharts option tuned for a modern, BI-grade look:
 * a curated palette, gradient fills, smoothed lines, polished tooltips, and
 * sensible axis density. KPI scorecards and the detail table are native HTML.
 * Mapping is wrapped so any error falls back to a table — never blank, never a throw.
 */

function toNumber(v: unknown): number {
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

function isDateField(field: FieldRef): boolean {
	return field.dataType === "date" || field.dataType === "datetime";
}

function colFormat(spec: VizSpec, key: string): VizColumn["format"] {
	return spec.columns.find((c) => c.key === key)?.format;
}

// ---- ECharts tooltip params (the lib types them loosely; narrow locally) ----
interface EParam {
	axisValue?: unknown;
	seriesName?: string;
	name?: string;
	value?: unknown;
	marker?: string;
	percent?: number;
}
function asParams(raw: unknown): EParam[] {
	return (Array.isArray(raw) ? raw : [raw]) as EParam[];
}

/** Axis tooltip: a header (date/category) + one formatted row per series. */
function axisTooltip(
	t: Theme,
	xIsDate: boolean,
	gran: DateGranularity,
	fmtByName: Record<string, VizColumn["format"]>,
): (raw: unknown) => string {
	return (raw) => {
		const items = asParams(raw);
		const first = items[0];
		if (!first) return "";
		const head = xIsDate
			? formatDate(first.axisValue, gran)
			: String(first.axisValue ?? "");
		const body = items
			.map((p) => {
				const fmt = p.seriesName ? fmtByName[p.seriesName] : undefined;
				return `<div style="display:flex;align-items:center;gap:8px;white-space:nowrap;margin-top:2px">${
					p.marker ?? ""
				}<span style="color:${t.tipMuted}">${
					p.seriesName ?? ""
				}</span><b style="margin-left:auto;padding-left:12px;color:${
					t.tipFg
				};font-variant-numeric:tabular-nums">${formatMeasure(
					Number(p.value),
					fmt,
				)}</b></div>`;
			})
			.join("");
		return `<div style="font-weight:600;color:${t.tipFg}">${head}</div>${body}`;
	};
}

function valueAxis(t: Theme, fmt: VizColumn["format"], name?: string) {
	return {
		type: "value" as const,
		splitNumber: 4,
		...(name
			? {
					name,
					nameLocation: "middle" as const,
					nameGap: 48,
					nameRotate: 90,
					nameTextStyle: { color: t.muted, fontSize: 12, fontWeight: 500 },
				}
			: {}),
		axisLine: { show: false },
		axisTick: { show: false },
		axisLabel: {
			color: t.muted,
			fontSize: 11,
			formatter: (v: unknown) => formatAxisTick(v, fmt),
		},
		splitLine: { lineStyle: { color: hexToRgba("#94a3b8", 0.14) } },
	};
}

function categoryAxis(
	t: Theme,
	categories: unknown[],
	xIsDate: boolean,
	gran: DateGranularity,
	opts: { interval: 0 | "auto"; rotate: number },
) {
	return {
		type: "category" as const,
		// Date values must be ISO strings: ECharts stringifies a category array
		// with Date.toString() ("Fri Oct 31 2025 …") which our formatter can't
		// parse — ISO keeps formatDate → "Oct 2025".
		data: categories.map((v) => (v instanceof Date ? v.toISOString() : v)),
		boundaryGap: true,
		axisLine: { show: false },
		axisTick: { show: false },
		axisLabel: {
			color: t.muted,
			fontSize: 11,
			interval: opts.interval,
			rotate: opts.rotate,
			hideOverlap: true,
			formatter: (v: unknown) =>
				xIsDate ? formatDate(v, gran) : String(v ?? ""),
		},
	};
}

function markLineFor(
	t: Theme,
	ref: { value: number; label: string },
	horizontal: boolean,
	fmt: VizColumn["format"],
) {
	return {
		silent: true,
		symbol: "none" as const,
		lineStyle: { type: "dashed" as const, color: t.muted, opacity: 0.7 },
		label: {
			color: t.muted,
			fontSize: 11,
			fontWeight: 600,
			position: "insideEndTop" as const,
			formatter: `${ref.label} ${formatAxisTick(ref.value, fmt)}`,
		},
		data: [horizontal ? { xAxis: ref.value } : { yAxis: ref.value }],
	};
}

/** Pivot long rows (x, series, value) → wide rows keyed by series value. */
function pivot(
	rows: Record<string, unknown>[],
	xKey: string,
	seriesKey: string,
	valueKey: string,
): { data: Record<string, unknown>[]; seriesValues: string[] } {
	const byX = new Map<string, Record<string, unknown>>();
	const seriesValues = new Set<string>();
	for (const row of rows) {
		const x = String(row[xKey]);
		const s = String(row[seriesKey]);
		seriesValues.add(s);
		const entry = byX.get(x) ?? { [xKey]: row[xKey] };
		entry[s] = toNumber(row[valueKey]);
		byX.set(x, entry);
	}
	return { data: [...byX.values()], seriesValues: [...seriesValues] };
}

// ---- Option builders --------------------------------------------------------

function buildChartOption(
	spec: VizSpec,
	colorOffset = 0,
): EChartsOption | null {
	try {
		return buildOptionInner(spec, colorOffset);
	} catch {
		return null; // total safety: any mapping error → table fallback
	}
}

function buildOptionInner(
	spec: VizSpec,
	colorOffset: number,
): EChartsOption | null {
	const { encoding, data, type } = spec;
	const t = theme();
	const grid = { left: 8, right: 28, top: 28, bottom: 8, containLabel: true };
	const tip = tooltipChrome(t);
	// Palette shifted per tile so each chart on a dashboard is a distinct color.
	const col = (i: number): string => color(i + colorOffset);

	// Combo: bars (left axis) + line(s) (right axis) — dual scale.
	if (
		type === "combo" &&
		encoding.x &&
		encoding.y?.length &&
		encoding.yRight?.length
	) {
		const xField = encoding.x;
		const xIsDate = isDateField(xField);
		const gran = xIsDate
			? dateGranularity(data.map((r) => r[xField.key]))
			: "day";
		const leftFmt = colFormat(spec, encoding.y[0]?.key ?? "");
		const rightFmt = colFormat(spec, encoding.yRight[0]?.key ?? "");
		const leftMeasures = encoding.y;
		const rightMeasures = encoding.yRight;
		const leftCount = leftMeasures.length;
		const fmtByName = Object.fromEntries(
			[...leftMeasures, ...rightMeasures].map((m) => [
				m.label,
				colFormat(spec, m.key),
			]),
		);
		const series = [
			...leftMeasures.map((m, i) => ({
				type: "bar" as const,
				name: m.label,
				yAxisIndex: 0,
				data: data.map((r) => toNumber(r[m.key])),
				barMaxWidth: 38,
				itemStyle: { color: barGradient(col(i)), borderRadius: [6, 6, 0, 0] },
			})),
			...rightMeasures.map((m, i) => ({
				type: "line" as const,
				name: m.label,
				yAxisIndex: 1,
				data: data.map((r) => toNumber(r[m.key])),
				smooth: true,
				showSymbol: true,
				symbolSize: 7,
				lineStyle: { width: 3, color: col(leftCount + i) },
				itemStyle: { color: col(leftCount + i) },
			})),
		];
		return {
			grid,
			legend: { top: 0, textStyle: { color: t.muted }, icon: "roundRect" },
			tooltip: {
				...tip,
				trigger: "axis",
				formatter: axisTooltip(t, xIsDate, gran, fmtByName),
			},
			xAxis: categoryAxis(
				t,
				data.map((r) => r[xField.key]),
				xIsDate,
				gran,
				{
					interval: "auto",
					rotate: 0,
				},
			),
			yAxis: [
				valueAxis(t, leftFmt),
				{
					...valueAxis(t, rightFmt),
					position: "right",
					splitLine: { show: false },
				},
			],
			series,
		} as EChartsOption;
	}

	// Line / area / step
	if (
		(type === "line" || type === "area" || type === "step") &&
		encoding.x &&
		encoding.y
	) {
		const xField = encoding.x;
		const measures = encoding.y;
		const single = measures.length === 1;
		const xIsDate = isDateField(xField);
		const gran = xIsDate
			? dateGranularity(data.map((r) => r[xField.key]))
			: "day";
		const yFmt = colFormat(spec, measures[0]?.key ?? "");
		const fmtByName = Object.fromEntries(
			measures.map((m) => [m.label, colFormat(spec, m.key)]),
		);
		const series = measures.map((m, i) => ({
			type: "line" as const,
			name: m.label,
			data: data.map((r) => toNumber(r[m.key])),
			// Step charts emphasize discrete changes; line/area are smoothed.
			smooth: type !== "step",
			...(type === "step" ? { step: "middle" as const } : {}),
			showSymbol: false,
			lineStyle: { width: 3, color: col(i) },
			itemStyle: { color: col(i) },
			emphasis: { focus: "series" as const },
			// A single trend reads beautifully as a soft filled area; multiple
			// overlapping fills get muddy, so only fill the single-series line case.
			...(type === "area" || (single && type === "line")
				? {
						areaStyle: {
							color: areaGradient(col(i)),
							origin: "start" as const,
						},
					}
				: {}),
		}));
		return {
			grid,
			legend:
				measures.length > 1
					? { top: 0, textStyle: { color: t.muted }, icon: "roundRect" }
					: undefined,
			tooltip: {
				...tip,
				trigger: "axis",
				axisPointer: { type: "line", lineStyle: { color: t.split } },
				formatter: axisTooltip(t, xIsDate, gran, fmtByName),
			},
			xAxis: categoryAxis(
				t,
				data.map((r) => r[xField.key]),
				xIsDate,
				gran,
				{
					interval: "auto",
					rotate: 0,
				},
			),
			yAxis: valueAxis(t, yFmt),
			series,
		} as EChartsOption;
	}

	// Grouped / stacked bar (x + series + one measure)
	if (
		(type === "groupedBar" || type === "stackedBar") &&
		encoding.x &&
		encoding.series &&
		encoding.y?.[0]
	) {
		const xField = encoding.x;
		const measureFmt = colFormat(spec, encoding.y[0].key);
		const { data: wide, seriesValues } = pivot(
			data,
			xField.key,
			encoding.series.key,
			encoding.y[0].key,
		);
		const xIsDate = isDateField(xField);
		const gran = xIsDate
			? dateGranularity(data.map((r) => r[xField.key]))
			: "day";
		const fmtByName = Object.fromEntries(
			seriesValues.map((s) => [s, measureFmt]),
		);
		const stacked = type === "stackedBar";
		const series = seriesValues.map((s, i) => ({
			type: "bar" as const,
			name: s,
			data: wide.map((w) => toNumber(w[s])),
			stack: stacked ? "total" : undefined,
			barMaxWidth: 48,
			itemStyle: {
				color: barGradient(col(i)),
				borderRadius: stacked ? 0 : [6, 6, 0, 0],
			},
		}));
		return {
			grid,
			legend: { top: 0, textStyle: { color: t.muted }, icon: "roundRect" },
			tooltip: {
				...tip,
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: axisTooltip(t, xIsDate, gran, fmtByName),
			},
			xAxis: categoryAxis(
				t,
				wide.map((w) => w[xField.key]),
				xIsDate,
				gran,
				{
					interval: "auto",
					rotate: 0,
				},
			),
			yAxis: valueAxis(t, measureFmt),
			series,
		} as EChartsOption;
	}

	// Stacked area (x + series + one measure) — composition over time.
	if (
		type === "stackedArea" &&
		encoding.x &&
		encoding.series &&
		encoding.y?.[0]
	) {
		const xField = encoding.x;
		const measureFmt = colFormat(spec, encoding.y[0].key);
		const { data: wide, seriesValues } = pivot(
			data,
			xField.key,
			encoding.series.key,
			encoding.y[0].key,
		);
		const xIsDate = isDateField(xField);
		const gran = xIsDate
			? dateGranularity(data.map((r) => r[xField.key]))
			: "day";
		const fmtByName = Object.fromEntries(
			seriesValues.map((s) => [s, measureFmt]),
		);
		const series = seriesValues.map((s, i) => ({
			type: "line" as const,
			name: s,
			data: wide.map((w) => toNumber(w[s])),
			stack: "total",
			smooth: true,
			showSymbol: false,
			lineStyle: { width: 1.5, color: col(i) },
			itemStyle: { color: col(i) },
			areaStyle: { color: hexToRgba(col(i), 0.5) },
		}));
		return {
			grid,
			legend: { top: 0, textStyle: { color: t.muted }, icon: "roundRect" },
			tooltip: {
				...tip,
				trigger: "axis",
				formatter: axisTooltip(t, xIsDate, gran, fmtByName),
			},
			xAxis: categoryAxis(
				t,
				wide.map((w) => w[xField.key]),
				xIsDate,
				gran,
				{ interval: "auto", rotate: 0 },
			),
			yAxis: valueAxis(t, measureFmt),
			series,
		} as EChartsOption;
	}

	// Dot plot — a cleaner horizontal alternative to bars for ranked comparison.
	if (type === "dotPlot" && encoding.x && encoding.y?.[0]) {
		const xField = encoding.x;
		const m = encoding.y[0];
		const fmt = colFormat(spec, m.key);
		const ref = spec.options?.referenceLine;
		return {
			grid: { ...grid, left: 8 },
			tooltip: {
				...tip,
				trigger: "item",
				formatter: (raw: unknown) => {
					const v = (asParams(raw)[0]?.value as [number, string]) ?? [0, ""];
					return `<span style="color:${t.tipMuted}">${v[1]}</span> <b style="color:${t.tipFg}">${formatMeasure(Number(v[0]), fmt)}</b>`;
				},
			},
			xAxis: {
				type: "value",
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					color: t.muted,
					fontSize: 11,
					formatter: (v: unknown) => formatAxisTick(v, fmt),
				},
				splitLine: { lineStyle: { color: hexToRgba("#94a3b8", 0.18) } },
			},
			yAxis: {
				type: "category",
				inverse: true,
				data: data.map((r) => String(r[xField.key])),
				axisLine: { lineStyle: { color: t.split } },
				axisTick: { show: false },
				axisLabel: { color: t.muted, fontSize: 11 },
			},
			series: [
				{
					type: "scatter",
					symbolSize: 15,
					data: data.map((r) => [toNumber(r[m.key]), String(r[xField.key])]),
					itemStyle: { color: col(0) },
					...(ref ? { markLine: markLineFor(t, ref, true, fmt) } : {}),
				},
			],
		} as EChartsOption;
	}

	// Histogram — distribution of one numeric column (bins computed from rows).
	if (type === "histogram" && encoding.value) {
		const key = encoding.value.key;
		const bins = histogramBins(data.map((r) => toNumber(r[key])));
		return {
			grid,
			tooltip: {
				...tip,
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (raw: unknown) => {
					const p = asParams(raw)[0];
					return `<div style="color:${t.tipMuted}">${p?.name ?? ""}</div><b style="color:${t.tipFg}">${p?.value ?? 0}</b> <span style="color:${t.tipMuted}">items</span>`;
				},
			},
			xAxis: {
				type: "category",
				data: bins.map((b) => b.label),
				name: encoding.value.label,
				nameLocation: "middle",
				nameGap: 38,
				nameTextStyle: { color: t.muted, fontSize: 12 },
				axisLine: { lineStyle: { color: t.split } },
				axisTick: { show: false },
				axisLabel: {
					color: t.muted,
					fontSize: 10,
					interval: "auto",
					rotate: bins.length > 8 ? 35 : 0,
				},
			},
			yAxis: valueAxis(t, "number", "Count"),
			series: [
				{
					type: "bar",
					data: bins.map((b) => b.count),
					itemStyle: { color: barGradient(col(0)), borderRadius: [4, 4, 0, 0] },
					barCategoryGap: "2%",
				},
			],
		} as EChartsOption;
	}

	// Box plot — five-number summary of raw values grouped by a category.
	if (type === "boxplot" && encoding.x && encoding.y?.[0]) {
		const xKey = encoding.x.key;
		const mKey = encoding.y[0].key;
		const fmt = colFormat(spec, mKey);
		const groups = new Map<string, number[]>();
		for (const r of data) {
			const k = String(r[xKey]);
			let arr = groups.get(k);
			if (!arr) {
				arr = [];
				groups.set(k, arr);
			}
			arr.push(toNumber(r[mKey]));
		}
		const cats = [...groups.keys()];
		const boxData = cats.map((c) => {
			const q = quartiles(groups.get(c) ?? []);
			return q ? [q.min, q.q1, q.median, q.q3, q.max] : [0, 0, 0, 0, 0];
		});
		return {
			grid,
			tooltip: {
				...tip,
				trigger: "item",
				formatter: (raw: unknown) => {
					const p = asParams(raw)[0];
					const v = (p?.value as number[]) ?? [];
					const n = v.length;
					const get = (k: number) => v[n - 1 - k] ?? 0; // max=0 … min=4
					return `<div style="color:${t.tipMuted}">${p?.name ?? ""}</div><div>median <b style="color:${t.tipFg}">${formatMeasure(get(2), fmt)}</b></div><div style="color:${t.tipMuted}">IQR ${formatMeasure(get(3), fmt)} – ${formatMeasure(get(1), fmt)}</div>`;
				},
			},
			xAxis: categoryAxis(t, cats, false, "day", {
				interval: 0,
				rotate: cats.length > 8 ? 35 : 0,
			}),
			yAxis: valueAxis(t, fmt),
			series: [
				{
					type: "boxplot",
					data: boxData,
					itemStyle: { color: hexToRgba(col(0), 0.45), borderColor: col(0) },
				},
			],
		} as EChartsOption;
	}

	// Density — smooth (KDE) distribution of one numeric column.
	if (type === "density" && encoding.value) {
		const key = encoding.value.key;
		const fmt = colFormat(spec, key);
		const pts = kde(data.map((r) => toNumber(r[key])));
		return {
			grid,
			tooltip: {
				...tip,
				trigger: "axis",
				formatter: (raw: unknown) =>
					`<b style="color:${t.tipFg}">${formatMeasure(Number(asParams(raw)[0]?.axisValue), fmt)}</b>`,
			},
			xAxis: {
				type: "value",
				name: encoding.value.label,
				nameLocation: "middle",
				nameGap: 30,
				nameTextStyle: { color: t.muted, fontSize: 12 },
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					color: t.muted,
					fontSize: 11,
					formatter: (v: unknown) => formatAxisTick(v, fmt),
				},
				splitLine: { lineStyle: { color: hexToRgba("#94a3b8", 0.18) } },
			},
			yAxis: { type: "value", show: false },
			series: [
				{
					type: "line",
					smooth: true,
					showSymbol: false,
					data: pts.map((p) => [p.x, p.y]),
					lineStyle: { width: 2, color: col(0) },
					areaStyle: { color: areaGradient(col(0)) },
				},
			],
		} as EChartsOption;
	}

	// Sparkline — a minimal trend (no axes) for embedding; renderer-ready.
	if (type === "sparkline" && encoding.y?.[0]) {
		const mKey = encoding.y[0].key;
		return {
			grid: { left: 2, right: 2, top: 4, bottom: 2 },
			tooltip: { ...tip, trigger: "axis", showContent: false },
			xAxis: { type: "category", show: false, data: data.map((_, i) => i) },
			yAxis: { type: "value", show: false },
			series: [
				{
					type: "line",
					smooth: true,
					showSymbol: false,
					data: data.map((r) => toNumber(r[mKey])),
					lineStyle: { width: 2, color: col(0) },
					areaStyle: { color: areaGradient(col(0)) },
				},
			],
		} as EChartsOption;
	}

	// Bar (one categorical dimension + measures)
	if (type === "bar" && encoding.x && encoding.y) {
		const xField = encoding.x;
		const measures = encoding.y;
		const horizontal = spec.options?.horizontal === true;
		const xIsDate = isDateField(xField);
		const gran = xIsDate
			? dateGranularity(data.map((r) => r[xField.key]))
			: "day";
		const yFmt = colFormat(spec, measures[0]?.key ?? "");
		const manyCats = data.length > 8;
		const showLabels = measures.length === 1 && data.length <= 12;
		const ref = spec.options?.referenceLine;
		const fmtByName = Object.fromEntries(
			measures.map((m) => [m.label, colFormat(spec, m.key)]),
		);
		// One cohesive hue per chart (tonal gradient), not rainbow-per-bar — the
		// premium look. Slim bars with rounded caps.
		const series = measures.map((m, mi) => ({
			type: "bar" as const,
			name: m.label,
			data: data.map((r) => toNumber(r[m.key])),
			barMaxWidth: 44,
			itemStyle: {
				color: barGradient(col(mi)),
				borderRadius: horizontal ? [0, 4, 4, 0] : [6, 6, 0, 0],
			},
			...(showLabels
				? {
						label: {
							show: true,
							position: horizontal ? ("right" as const) : ("top" as const),
							color: t.fg,
							fontSize: 11,
							fontWeight: 600,
							formatter: (p: unknown) =>
								formatAxisTick(Number((p as EParam).value), yFmt),
						},
					}
				: {}),
			...(mi === 0 && ref
				? { markLine: markLineFor(t, ref, horizontal, yFmt) }
				: {}),
		}));
		const value = valueAxis(t, yFmt);
		const category = categoryAxis(
			t,
			data.map((r) => r[xField.key]),
			xIsDate,
			gran,
			{
				interval: 0,
				rotate: !horizontal && manyCats ? 35 : 0,
			},
		);
		return {
			grid,
			legend:
				measures.length > 1
					? { top: 0, textStyle: { color: t.muted }, icon: "roundRect" }
					: undefined,
			tooltip: {
				...tip,
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: axisTooltip(t, xIsDate, gran, fmtByName),
			},
			xAxis: horizontal ? value : category,
			yAxis: horizontal ? category : value,
			series,
		} as EChartsOption;
	}

	// Pie / donut (part-to-whole)
	if (type === "pie" && encoding.category && encoding.value) {
		const valueKey = encoding.value.key;
		const nameKey = encoding.category.key;
		const donut = spec.options?.donut === true;
		const valueFormat = colFormat(spec, valueKey) ?? "number";
		const catIsDate = isDateField(encoding.category);
		const catGran = catIsDate
			? dateGranularity(data.map((r) => r[nameKey]))
			: "day";
		const pieData = data.map((r, i) => ({
			name: catIsDate ? formatDate(r[nameKey], catGran) : String(r[nameKey]),
			value: toNumber(r[valueKey]),
			itemStyle: { color: col(i) },
		}));
		const total =
			donut && !spec.meta.truncated
				? pieData.reduce((s, d) => s + d.value, 0)
				: null;
		return {
			color: [...PALETTE],
			tooltip: {
				...tip,
				trigger: "item",
				formatter: (raw: unknown) => {
					const p = asParams(raw)[0];
					if (!p) return "";
					return `${p.marker ?? ""} <span style="color:${t.tipFg}">${
						p.name ?? ""
					}</span>: <b style="color:${t.tipFg}">${formatMeasure(
						Number(p.value),
						valueFormat,
					)}</b> <span style="color:${t.tipMuted}">(${p.percent ?? 0}%)</span>`;
				},
			},
			legend: {
				type: "scroll",
				bottom: 0,
				textStyle: { color: t.muted },
				icon: "circle",
			},
			...(total != null
				? {
						title: {
							text: formatHeadline(total, valueFormat),
							subtext: "Total",
							left: "center",
							top: "center",
							textAlign: "center",
							textStyle: { fontSize: 20, fontWeight: 700, color: t.fg },
							subtextStyle: { fontSize: 12, color: t.muted },
						},
					}
				: {}),
			series: [
				{
					type: "pie",
					radius: donut ? ["52%", "76%"] : ["0%", "74%"],
					center: ["50%", "46%"],
					data: pieData,
					padAngle: donut ? 2 : 1,
					itemStyle: { borderColor: t.bg, borderWidth: 2, borderRadius: 6 },
					label: donut
						? { show: false }
						: {
								color: t.fg,
								fontSize: 11,
								formatter: "{b}\n{d}%",
							},
					labelLine: { show: !donut, smooth: true },
					emphasis: {
						scaleSize: 6,
						itemStyle: {
							shadowBlur: 16,
							shadowColor: hexToRgba("#0f172a", 0.18),
						},
					},
				},
			],
		} as EChartsOption;
	}

	// Scatter (two measures)
	if (type === "scatter" && encoding.x && encoding.y?.[0]) {
		const xField = encoding.x;
		const yField = encoding.y[0];
		const xFmt = colFormat(spec, xField.key);
		const yFmt = colFormat(spec, yField.key);
		return {
			grid,
			tooltip: {
				...tip,
				trigger: "item",
				formatter: (raw: unknown) => {
					const p = asParams(raw)[0];
					const v = (p?.value as number[]) ?? [];
					return `<span style="color:${t.tipMuted}">${
						xField.label
					}</span> <b style="color:${t.tipFg}">${formatMeasure(
						v[0] ?? 0,
						xFmt,
					)}</b><br/><span style="color:${t.tipMuted}">${
						yField.label
					}</span> <b style="color:${t.tipFg}">${formatMeasure(v[1] ?? 0, yFmt)}</b>`;
				},
			},
			xAxis: {
				type: "value",
				name: xField.label,
				nameLocation: "middle",
				nameGap: 28,
				nameTextStyle: { color: t.muted, fontSize: 12 },
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					color: t.muted,
					fontSize: 11,
					formatter: (v: unknown) => formatAxisTick(v, xFmt),
				},
				splitLine: { lineStyle: { color: hexToRgba("#94a3b8", 0.18) } },
			},
			yAxis: valueAxis(t, yFmt, yField.label),
			series: [
				{
					type: "scatter",
					symbolSize: 12,
					itemStyle: { color: hexToRgba(col(0), 0.7), borderColor: col(0) },
					data: data.map((r) => [
						toNumber(r[xField.key]),
						toNumber(r[yField.key]),
					]),
				},
			],
		} as EChartsOption;
	}

	// Heatmap — a measure across two categorical axes (matrix), tinted by value.
	if (type === "heatmap" && encoding.x && encoding.series && encoding.value) {
		const xKey = encoding.x.key;
		const yKey = encoding.series.key;
		const vKey = encoding.value.key;
		const fmt = colFormat(spec, vKey);
		const xIsDate = isDateField(encoding.x);
		const xGran = xIsDate ? dateGranularity(data.map((r) => r[xKey])) : "day";
		const asKey = (v: unknown): string =>
			v instanceof Date ? v.toISOString() : String(v ?? "");
		// Preserve first-seen order (the SQL already orders the axes sensibly).
		const ordered = (key: string): string[] => {
			const seen = new Set<string>();
			const out: string[] = [];
			for (const r of data) {
				const k = asKey(r[key]);
				if (!seen.has(k)) {
					seen.add(k);
					out.push(k);
				}
			}
			return out;
		};
		const xs = ordered(xKey);
		const ys = ordered(yKey);
		const xIndex = new Map(xs.map((v, i) => [v, i]));
		const yIndex = new Map(ys.map((v, i) => [v, i]));
		let maxV = 0;
		const cells = data.map((r) => {
			const v = toNumber(r[vKey]);
			if (v > maxV) maxV = v;
			return [xIndex.get(asKey(r[xKey])) ?? 0, yIndex.get(asKey(r[yKey])) ?? 0, v];
		});
		return {
			grid: { left: 8, right: 16, top: 12, bottom: 60, containLabel: true },
			tooltip: {
				...tip,
				trigger: "item",
				formatter: (raw: unknown) => {
					const p = asParams(raw)[0];
					const v = (p?.value as [number, number, number]) ?? [0, 0, 0];
					const xl = xIsDate ? formatDate(xs[v[0]], xGran) : (xs[v[0]] ?? "");
					return `<div style="color:${t.tipMuted}">${ys[v[1]] ?? ""} · ${xl}</div><b style="color:${t.tipFg}">${formatMeasure(v[2], fmt)}</b>`;
				},
			},
			xAxis: {
				type: "category",
				data: xs,
				splitArea: { show: false },
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					color: t.muted,
					fontSize: 11,
					hideOverlap: true,
					formatter: (v: unknown) =>
						xIsDate ? formatDate(v, xGran) : String(v ?? ""),
				},
			},
			yAxis: {
				type: "category",
				data: ys,
				splitArea: { show: false },
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { color: t.muted, fontSize: 11 },
			},
			visualMap: {
				min: 0,
				max: maxV || 1,
				calculable: true,
				orient: "horizontal",
				left: "center",
				bottom: 0,
				itemWidth: 14,
				itemHeight: 140,
				textStyle: { color: t.muted, fontSize: 10 },
				inRange: { color: heatmapRamp(col(0)) },
				formatter: (v: unknown) => formatAxisTick(v, fmt),
			},
			series: [
				{
					type: "heatmap",
					data: cells,
					label: { show: false },
					itemStyle: { borderColor: t.bg, borderWidth: 2, borderRadius: 4 },
					emphasis: {
						itemStyle: {
							shadowBlur: 10,
							shadowColor: hexToRgba("#0f172a", 0.2),
						},
					},
				},
			],
		} as EChartsOption;
	}

	return null;
}

// ---- Native (non-chart) pieces ---------------------------------------------

/** Period-over-period chip: green ▲ / red ▼ (flipped for "lower is better"). */
function DeltaChip({ delta }: { delta: KpiDelta }): React.JSX.Element {
	if (delta.direction === "flat") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
				±0%
			</span>
		);
	}
	const isUp = delta.direction === "up";
	const good = isUp === (delta.positiveIsGood ?? true);
	const pct = Math.abs(delta.pct);
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs tabular-nums",
				good
					? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
					: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
			)}
		>
			{isUp ? "▲" : "▼"} {(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}%
		</span>
	);
}

function KpiCard({ kpi }: { kpi: KpiSpec }): React.JSX.Element {
	return (
		<div className={CARD_CLASS}>
			<div className="text-muted-foreground text-sm">{kpi.label}</div>
			<div className="mt-1 flex items-baseline gap-2">
				<span className="font-semibold text-2xl tabular-nums">
					{formatHeadline(kpi.value, kpi.format)}
				</span>
				{kpi.delta ? <DeltaChip delta={kpi.delta} /> : null}
			</div>
			{kpi.delta?.caption ? (
				<div className="mt-1 text-muted-foreground text-xs">
					{kpi.delta.caption}
				</div>
			) : null}
		</div>
	);
}

function KpiRow({ cards }: { cards: KpiSpec[] }): React.JSX.Element | null {
	if (cards.length === 0) return null;
	const cols =
		cards.length >= 3
			? "sm:grid-cols-3"
			: cards.length === 2
				? "sm:grid-cols-2"
				: "sm:grid-cols-1";
	return (
		<div className={cn("grid grid-cols-1 gap-3", cols)}>
			{cards.map((k) => (
				<KpiCard key={k.label} kpi={k} />
			))}
		</div>
	);
}

function isNumericColumn(c: VizColumn): boolean {
	return c.format != null || c.dataType === "number";
}

function formatTableCell(
	value: unknown,
	column: VizColumn,
	gran: DateGranularity,
): string {
	if (value == null) return "—";
	if (column.dataType === "date" || column.dataType === "datetime") {
		return formatDate(value, gran);
	}
	if (column.format) {
		const n = typeof value === "number" ? value : Number(value);
		if (Number.isFinite(n)) return formatMeasure(n, column.format);
	}
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function DataTable({ spec }: { spec: VizSpec }): React.JSX.Element {
	const granByCol = new Map<string, DateGranularity>();
	for (const c of spec.columns) {
		if (c.dataType === "date" || c.dataType === "datetime") {
			granByCol.set(c.key, dateGranularity(spec.data.map((r) => r[c.key])));
		}
	}
	return (
		<div className="max-h-96 overflow-auto rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						{spec.columns.map((c) => (
							<TableHead
								key={c.key}
								className={cn(isNumericColumn(c) && "text-right")}
							>
								{c.label}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{spec.data.map((row, i) => (
						<TableRow key={`row-${i}`}>
							{spec.columns.map((c) => (
								<TableCell
									key={c.key}
									className={cn(
										"tabular-nums",
										isNumericColumn(c) && "text-right",
									)}
								>
									{formatTableCell(
										row[c.key],
										c,
										granByCol.get(c.key) ?? "day",
									)}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function Chart({
	spec,
	colorOffset = 0,
}: {
	spec: VizSpec;
	colorOffset?: number;
}): React.JSX.Element {
	const option = useMemo(
		() => buildChartOption(spec, colorOffset),
		[spec, colorOffset],
	);

	if (spec.type === "kpi" && spec.encoding.value) {
		return (
			<KpiCard
				kpi={{
					label: spec.encoding.value.label,
					value: toNumber(spec.data[0]?.[spec.encoding.value.key]),
					format: colFormat(spec, spec.encoding.value.key) ?? "number",
				}}
			/>
		);
	}
	if (!option) return <DataTable spec={spec} />;
	return <EChart option={option} height={spec.type === "pie" ? 360 : 320} />;
}

export function VizRenderer({
	answer,
	className,
	colorOffset = 0,
}: {
	answer: AskBiAnswer;
	className?: string;
	/** Shifts the palette so each chart on a dashboard reads as a distinct color. */
	colorOffset?: number;
}): React.JSX.Element {
	// Single-row result: render scorecards instead of a (meaningless) 1-point chart.
	if (answer.primary.type === "kpi") {
		const cards = answer.kpis ?? (answer.kpi ? [answer.kpi] : []);
		if (cards.length > 0) {
			return (
				<div className={className}>
					<KpiRow cards={cards} />
				</div>
			);
		}
	}
	return (
		<div className={cn("space-y-3", className)}>
			{answer.kpi && answer.primary.type !== "kpi" && (
				<KpiCard kpi={answer.kpi} />
			)}
			<Chart spec={answer.primary} colorOffset={colorOffset} />
		</div>
	);
}
