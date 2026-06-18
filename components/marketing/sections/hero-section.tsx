import { ArrowRightIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * AskBI hero — warm, airy, friendly (matching the Framer homepage language):
 * a soft sky→cream backdrop, a rounded geometric display headline, dark-ink pill
 * CTAs, and a product mock floating in a soft rounded card.
 */

const CHART = [38, 52, 44, 61, 70, 58, 82, 95];

/** Original "ask → chart" product mock — reads as AskBI, copies nothing. */
function HeroMock() {
	return (
		<div className="mx-auto w-full max-w-2xl rounded-[20px] border border-marketing-border bg-white p-5 text-left shadow-[0_30px_60px_-20px_rgba(26,22,21,0.22),0_12px_24px_-16px_rgba(26,22,21,0.18)]">
			{/* Ask bar */}
			<div className="flex items-center gap-2.5 rounded-2xl border border-marketing-border bg-marketing-bg-subtle px-4 py-3">
				<SparklesIcon className="size-4 shrink-0 text-marketing-brand" />
				<span className="text-marketing-fg-muted text-sm">
					How did revenue trend this quarter?
				</span>
			</div>

			{/* KPI chips */}
			<div className="mt-4 grid grid-cols-2 gap-3">
				{[
					{ label: "Revenue", value: "$1.24M", delta: "+18%" },
					{ label: "Orders", value: "4,820", delta: "+6%" },
				].map((k) => (
					<div
						key={k.label}
						className="rounded-2xl border border-marketing-border bg-white p-3"
					>
						<div className="text-marketing-fg-subtle text-xs">{k.label}</div>
						<div className="mt-0.5 flex items-baseline gap-1.5">
							<span className="font-bold text-lg text-marketing-fg tabular-nums">
								{k.value}
							</span>
							<span className="font-semibold text-[#0ea158] text-xs">
								▲ {k.delta}
							</span>
						</div>
					</div>
				))}
			</div>

			{/* Mini bar chart */}
			<div className="mt-4 rounded-2xl border border-marketing-border bg-white p-4">
				<div className="mb-3 flex items-center justify-between">
					<span className="font-semibold text-marketing-fg text-sm">
						Revenue by month
					</span>
					<span className="text-marketing-fg-subtle text-xs">2025</span>
				</div>
				<div className="flex h-28 items-end gap-2">
					{CHART.map((h, i) => (
						<div
							key={`bar-${i}`}
							className="flex-1 rounded-t-[5px] bg-gradient-to-b from-marketing-brand to-marketing-brand/40"
							style={{ height: `${h}%` }}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export function HeroSection() {
	return (
		<section
			id="hero"
			className="marketing-hero-gradient relative scroll-mt-14 overflow-hidden pt-20 pb-16 lg:pt-28"
		>
			<div className="container relative mx-auto max-w-[1080px] px-6 lg:px-10">
				<div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
					<Link
						href="/blog"
						className={cn(
							"inline-flex items-center gap-2 rounded-full border border-marketing-border bg-white/80 px-3 py-1 text-sm backdrop-blur",
							"text-marketing-fg-muted transition-colors hover:text-marketing-fg",
						)}
					>
						<span className="font-bold text-marketing-brand">New</span>
						<span className="h-3 w-px bg-marketing-border" />
						<span>Auto-built dashboards for every source</span>
						<ChevronRightIcon className="size-3.5" />
					</Link>

					<span className="font-bold text-marketing-brand text-sm uppercase tracking-[0.12em]">
						Conversational BI
					</span>

					<h1 className="font-marketing-display font-extrabold text-5xl text-marketing-fg leading-[1.06] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
						Ask your data anything.
					</h1>

					<p className="max-w-xl text-balance text-lg text-marketing-fg-muted leading-8">
						Connect a database or drop a CSV, ask a question in plain English,
						and AskBI writes the SQL, picks the right chart, and builds the
						dashboard — read-only and grounded in your real schema.
					</p>

					<div className="flex flex-wrap items-center justify-center gap-3 pt-1">
						<Link
							href="/auth/sign-up"
							className={cn(
								"group inline-flex h-11 items-center gap-1.5 rounded-full px-5 font-semibold text-sm",
								"bg-marketing-accent text-marketing-accent-fg transition-colors hover:bg-marketing-accent-hover",
							)}
						>
							Start free
							<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
						<Link
							href="/contact"
							className={cn(
								"group inline-flex h-11 items-center gap-1.5 rounded-full border border-marketing-border bg-white/70 px-5 font-semibold text-sm",
								"text-marketing-fg transition-colors hover:bg-white",
							)}
						>
							Book a demo
							<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
					</div>

					<p className="text-marketing-fg-subtle text-sm">
						No credit card required · Read-only by design
					</p>
				</div>

				<div className="relative mt-14">
					<HeroMock />
				</div>
			</div>
		</section>
	);
}
