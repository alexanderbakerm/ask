interface Stat {
	value: string;
	label: string;
	description: string;
}

const stats: Stat[] = [
	{
		value: "18",
		label: "Chart types",
		description: "auto-selected from your data's shape",
	},
	{
		value: "<5s",
		label: "To first dashboard",
		description: "connect a source and charts appear",
	},
	{
		value: "100%",
		label: "Read-only queries",
		description: "SELECT-only, validated, row-capped",
	},
	{
		value: "0",
		label: "Result rows stored",
		description: "we audit the query, never the data",
	},
];

export function StatsSection() {
	return (
		<section id="stats" className="bg-marketing-bg-subtle py-20 lg:py-28">
			<div className="mx-auto max-w-[1120px] px-6 lg:px-10">
				<div className="flex max-w-2xl flex-col gap-4">
					<span className="font-medium text-marketing-brand text-sm uppercase tracking-[0.12em]">
						By the numbers
					</span>
					<h2 className="text-pretty font-marketing-display font-extrabold text-4xl text-marketing-fg tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.1]">
						Built for analysts, safe for engineers
					</h2>
				</div>

				<div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-marketing-border bg-marketing-border lg:grid-cols-4">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="flex flex-col gap-1 bg-marketing-bg-elevated p-7"
						>
							<div className="font-marketing-display font-extrabold text-4xl text-marketing-fg tabular-nums tracking-[-0.02em]">
								{stat.value}
							</div>
							<div className="mt-1 font-medium text-marketing-fg text-sm">
								{stat.label}
							</div>
							<p className="text-marketing-fg-muted text-sm leading-6">
								{stat.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
