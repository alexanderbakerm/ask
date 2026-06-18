"use client";

import { InfoIcon } from "lucide-react";
import type * as React from "react";
import type { AskBiAnswer } from "@/lib/ai/askbi/viz/spec";
import { SqlDisclosure } from "./sql-disclosure";
import { VizRenderer } from "./viz-renderer";

/** An informational (not error) note — amber, calm. */
function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-1.5 text-amber-900 text-xs dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
			<InfoIcon className="size-3.5 shrink-0" />
			<span>{children}</span>
		</div>
	);
}

/**
 * Renders the answer of record: the honesty surfaces (truncation, snapshot, and
 * approximate-count notes) ABOVE the chart where they can't be missed, then the
 * viz, then the always-present SQL disclosure.
 */
export function AskBiAnswerView({
	answer,
	colorOffset = 0,
	description,
}: {
	answer: AskBiAnswer;
	/** Palette shift so each chart on a dashboard is a distinct color. */
	colorOffset?: number;
	/** One-sentence caption rendered under the chart (dashboard tiles). */
	description?: string;
}): React.JSX.Element {
	const { meta } = answer.primary;
	return (
		<div className="space-y-2">
			{meta.truncated && (
				<Note>
					Showing the first {meta.rowCount.toLocaleString()} rows — the full
					result was larger.
				</Note>
			)}
			{meta.snapshotTruncated && (
				<Note>
					Snapshot of the first {meta.rowCount.toLocaleString()} rows — re-run
					for the full result.
				</Note>
			)}
			{meta.approxNote && <Note>{meta.approxNote}</Note>}
			{meta.notes?.map((note) => (
				<Note key={note}>{note}</Note>
			))}
			<VizRenderer answer={answer} colorOffset={colorOffset} />
			{description && (
				<p className="text-muted-foreground text-sm">{description}</p>
			)}
			<SqlDisclosure sql={meta.sql} />
		</div>
	);
}
