import {
	type LucideIcon,
	DatabaseIcon,
	LayoutDashboardIcon,
	MessagesSquareIcon,
	ShieldCheckIcon,
} from "lucide-react";

interface Feature {
	icon: LucideIcon;
	eyebrow: string;
	title: string;
	description: string;
}

const features: Feature[] = [
	{
		icon: DatabaseIcon,
		eyebrow: "Connect",
		title: "Any source, in minutes",
		description:
			"Point AskBI at a Postgres database with read-only credentials, or drop a CSV. We introspect the schema and ground every answer in your real tables.",
	},
	{
		icon: MessagesSquareIcon,
		eyebrow: "Ask",
		title: "Plain English, real SQL",
		description:
			"Ask a question the way you'd ask a teammate. AskBI writes the SQL, runs it read-only, and shows you exactly what it ran — no black box.",
	},
	{
		icon: LayoutDashboardIcon,
		eyebrow: "Visualize",
		title: "Dashboards that build themselves",
		description:
			"Connect a source and a full dashboard appears — KPIs with period-over-period deltas, trends, breakdowns, and heatmaps, each chart chosen from the data's shape.",
	},
	{
		icon: ShieldCheckIcon,
		eyebrow: "Trust",
		title: "Read-only by design",
		description:
			"A SELECT-only validator, a read-only role, an injected row limit, and a statement timeout sit on every query. Result sets are never stored.",
	},
];

function FeatureCard({ feature }: { feature: Feature }) {
	const Icon = feature.icon;
	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-marketing-border bg-marketing-bg-elevated p-7 shadow-[0_1px_2px_rgba(50,50,93,0.06)] transition-shadow hover:shadow-[0_18px_36px_-18px_rgba(50,50,93,0.25)]">
			<div className="flex size-11 items-center justify-center rounded-xl bg-marketing-brand/10 text-marketing-brand">
				<Icon className="size-5" />
			</div>
			<div>
				<div className="font-medium text-marketing-brand text-xs uppercase tracking-[0.12em]">
					{feature.eyebrow}
				</div>
				<h3 className="mt-1.5 font-semibold text-lg text-marketing-fg">
					{feature.title}
				</h3>
				<p className="mt-2 text-marketing-fg-muted text-sm leading-7">
					{feature.description}
				</p>
			</div>
		</div>
	);
}

export function FeaturesSection() {
	return (
		<section id="features" className="scroll-mt-14 py-20 lg:py-28">
			<div className="mx-auto max-w-[1120px] px-6 lg:px-10">
				<div className="flex max-w-2xl flex-col gap-4">
					<span className="font-medium text-marketing-brand text-sm uppercase tracking-[0.12em]">
						The platform
					</span>
					<h2 className="text-pretty font-marketing-display font-extrabold text-4xl text-marketing-fg tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.1]">
						From raw data to a dashboard, in one conversation
					</h2>
					<p className="text-balance text-lg text-marketing-fg-muted leading-8">
						AskBI turns a connected source into answers and visuals
						automatically — grounded in your schema, safe by construction.
					</p>
				</div>

				<div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{features.map((feature) => (
						<FeatureCard key={feature.title} feature={feature} />
					))}
				</div>
			</div>
		</section>
	);
}
