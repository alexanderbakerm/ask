"use client";

import { cn } from "@/lib/utils";

const changelog = [
	{
		version: "2.1.0",
		date: "December 2025",
		items: [
			{
				title: "Team workspaces",
				description:
					"Create separate workspaces for different teams or projects.",
			},
			{
				title: "Custom fields",
				description:
					"Add your own fields to track the data that matters to you.",
			},
			{
				title: "Faster search",
				description: "Search results now appear instantly as you type.",
			},
		],
	},
	{
		version: "2.0.0",
		date: "November 2025",
		items: [
			{
				title: "New dashboard",
				description:
					"Completely redesigned dashboard with better insights at a glance.",
			},
			{
				title: "Mobile app",
				description:
					"Access your data on the go with our new iOS and Android apps.",
			},
			{
				title: "Integrations",
				description: "Connect with Slack, Google Workspace and more.",
			},
		],
	},
	{
		version: "1.0.0",
		date: "October 2025",
		items: [
			{
				title: "Launch",
				description:
					"First public release with core features for team collaboration.",
			},
			{
				title: "Team management",
				description: "Invite team members, set roles and work together.",
			},
			{
				title: "Data export",
				description: "Export your data anytime in CSV or JSON format.",
			},
		],
	},
];

export function ChangelogSection() {
	return (
		<main className="isolate overflow-clip">
			{/* Hero Section */}
			<section className="py-16 pt-32 lg:pt-40" id="changelog-hero">
				<div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
					<h1
						className={cn(
							"text-balance font-display text-5xl leading-12 tracking-tight",
							"text-marketing-fg",
							"sm:text-[5rem] sm:leading-20",
						)}
					>
						Changelog
					</h1>
					<div className="max-w-3xl text-lg leading-8 text-marketing-fg-muted">
						<p>
							See what we've been working on. New features and improvements
							every month.
						</p>
					</div>
				</div>
			</section>

			{/* Changelog Entries */}
			<section className="py-16" id="releases">
				<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
					<div className="flex flex-col gap-16">
						{changelog.map((release) => (
							<div key={release.version} className="flex flex-col gap-6">
								{/* Version Header */}
								<div className="flex items-center gap-4">
									<span className="inline-flex rounded-full bg-marketing-accent px-3 py-1 text-sm font-medium text-primary-foreground">
										v{release.version}
									</span>
									<span className="text-sm text-marketing-fg-subtle">
										{release.date}
									</span>
								</div>

								{/* Release Items */}
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{release.items.map((item, itemIndex) => (
										<div
											key={itemIndex}
											className="flex flex-col gap-2 rounded-xl bg-marketing-card p-6"
										>
											<h3 className="font-semibold text-marketing-fg">
												{item.title}
											</h3>
											<p className="text-sm text-marketing-fg-muted">
												{item.description}
											</p>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
