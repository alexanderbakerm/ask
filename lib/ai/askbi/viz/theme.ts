/**
 * AskBI design tokens — the single source of truth for the visual language
 * shared by every chart (the ECharts renderer) AND the surrounding cards
 * (dashboard tiles + chat answers). Library-agnostic on purpose: it names
 * colors, gradients, the tooltip "pill", and card chrome, but no chart library.
 *
 * This module is plain (no `"use client"`) so it can be imported by both client
 * chart code and server tile components. `theme()` reads CSS variables, so it is
 * only meaningful on the client — it guards `document` and returns sensible
 * fallbacks elsewhere (e.g. during SSR / node rendering).
 */

// Curated, vibrant-but-tasteful categorical palette (indigo, sky, emerald,
// amber, pink, …), independent of the app accent so charts read "designed".
export const PALETTE = [
	"#6366f1",
	"#0ea5e9",
	"#10b981",
	"#f59e0b",
	"#ec4899",
	"#8b5cf6",
	"#14b8a6",
	"#ef4444",
] as const;

/** Series color by index, wrapping the palette. */
export function color(i: number): string {
	return PALETTE[i % PALETTE.length] ?? PALETTE[0];
}

export interface Theme {
	fg: string;
	muted: string;
	split: string;
	bg: string;
	/** Dark "pill" tooltip surface + its text colors (the reference aesthetic). */
	tipBg: string;
	tipFg: string;
	tipMuted: string;
	/** Delta-chip semantics for KPI period-over-period change. */
	positive: string;
	negative: string;
	neutral: string;
}

function cssVar(name: string, fallback: string): string {
	if (typeof document === "undefined") return fallback;
	const v = getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
	return v || fallback;
}

/** Neutral tokens come from the app theme (so light/dark match); series colors
 * come from the curated PALETTE above. */
export function theme(): Theme {
	return {
		fg: cssVar("--foreground", "#0f172a"),
		muted: cssVar("--muted-foreground", "#64748b"),
		split: cssVar("--border", "#e2e8f0"),
		bg: cssVar("--background", "#ffffff"),
		tipBg: "rgba(15, 23, 42, 0.92)",
		tipFg: "#f8fafc",
		tipMuted: "#94a3b8",
		positive: "#10b981",
		negative: "#ef4444",
		neutral: "#64748b",
	};
}

export function hexToRgba(hex: string, a: number): string {
	const m = hex.replace("#", "");
	const n =
		m.length === 3
			? m
					.split("")
					.map((c) => c + c)
					.join("")
			: m;
	const r = Number.parseInt(n.slice(0, 2), 16);
	const g = Number.parseInt(n.slice(2, 4), 16);
	const b = Number.parseInt(n.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Vertical fill gradient for bars: solid on top, softer at the base. */
export function barGradient(hex: string): Record<string, unknown> {
	return {
		type: "linear",
		x: 0,
		y: 0,
		x2: 0,
		y2: 1,
		colorStops: [
			{ offset: 0, color: hex },
			{ offset: 1, color: hexToRgba(hex, 0.55) },
		],
	};
}

/** Rich area gradient under a line: saturated at the line, fading to nothing. */
export function areaGradient(hex: string): Record<string, unknown> {
	return {
		type: "linear",
		x: 0,
		y: 0,
		x2: 0,
		y2: 1,
		colorStops: [
			{ offset: 0, color: hexToRgba(hex, 0.42) },
			{ offset: 0.55, color: hexToRgba(hex, 0.14) },
			{ offset: 1, color: hexToRgba(hex, 0.02) },
		],
	};
}

/** Sequential tint ramp for heatmaps: a wash of the hue → full saturation. */
export function heatmapRamp(hex: string): [string, string, string] {
	return [hexToRgba(hex, 0.06), hexToRgba(hex, 0.45), hex];
}

/** Dark rounded "pill" tooltip — the signature look from the reference designs. */
export function tooltipChrome(t: Theme): Record<string, unknown> {
	return {
		backgroundColor: t.tipBg,
		borderWidth: 0,
		padding: [10, 14],
		textStyle: { color: t.tipFg, fontSize: 12 },
		extraCssText:
			"border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,0.28);backdrop-filter:blur(6px);",
	};
}

/**
 * Shared card chrome (white surface, large radius, soft layered shadow,
 * generous padding) used by KPI cards and chart tiles so dashboard + chat read
 * as one product. A plain class string → safe to import from server components.
 */
export const CARD_CLASS =
	"rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]";
