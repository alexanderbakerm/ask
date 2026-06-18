"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const benefits = [
	{
		title: "Flexible Work",
		description:
			"Work from anywhere. We care about results, not where you sit.",
	},
	{
		title: "Great Team",
		description:
			"Work with talented, kind people who care about doing good work.",
	},
	{
		title: "Room to Grow",
		description:
			"Take on new challenges. Learn new skills. Grow your career with us.",
	},
];

const positions = [
	{
		title: "Software Engineer",
		department: "Engineering",
		description:
			"Build features that help thousands of teams work better. Full-stack role.",
		type: "Full-time",
		location: "Remote",
	},
	{
		title: "Product Designer",
		department: "Design",
		description:
			"Shape how people experience our product. Research, design and iterate.",
		type: "Full-time",
		location: "Remote",
	},
	{
		title: "Customer Support",
		department: "Support",
		description:
			"Help our customers succeed. Solve problems and make people happy.",
		type: "Full-time",
		location: "Remote",
	},
	{
		title: "Marketing Manager",
		department: "Marketing",
		description:
			"Tell our story. Help more teams discover what we're building.",
		type: "Full-time",
		location: "Remote",
	},
];

export function CareersBenefitsSection() {
	return (
		<>
			{/* Hero Section */}
			<section className="py-16 pt-32 lg:pt-40" id="careers-hero">
				<div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
					<h1
						className={cn(
							"text-balance font-display text-5xl leading-12 tracking-tight",
							"text-marketing-fg",
							"sm:text-[5rem] sm:leading-20",
						)}
					>
						Join our team
					</h1>
					<div className="max-w-3xl text-lg leading-8 text-marketing-fg-muted">
						<p>
							We're looking for people who want to do meaningful work and have
							fun doing it. Help us build tools that teams love.
						</p>
					</div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="py-16" id="benefits">
				<div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 md:max-w-3xl lg:max-w-7xl lg:gap-16 lg:px-10">
					<div className="flex max-w-2xl flex-col gap-6">
						<div className="flex flex-col gap-2">
							<h2
								className={cn(
									"text-pretty font-display text-[2rem] leading-10 tracking-tight",
									"text-marketing-fg",
									"sm:text-5xl sm:leading-14",
								)}
							>
								Why work with us
							</h2>
						</div>
					</div>
					<div>
						<ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
							{benefits.map((benefit) => (
								<li
									key={benefit.title}
									className="relative flex flex-col gap-4 rounded-lg bg-marketing-card p-6"
								>
									<div>
										<p className="font-semibold text-marketing-fg">
											{benefit.title}
										</p>
										<p className="mt-2 text-sm text-marketing-fg-muted">
											{benefit.description}
										</p>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>
		</>
	);
}

export function CareersPositionsSection() {
	return (
		<>
			{/* Open Positions */}
			<section className="py-16" id="positions">
				<div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 md:max-w-3xl lg:max-w-7xl lg:gap-16 lg:px-10">
					<div className="flex max-w-2xl flex-col gap-6">
						<div className="flex flex-col gap-2">
							<h2
								className={cn(
									"text-pretty font-display text-[2rem] leading-10 tracking-tight",
									"text-marketing-fg",
									"sm:text-5xl sm:leading-14",
								)}
							>
								Open positions
							</h2>
						</div>
					</div>
					<div className="divide-y divide-marketing-border border-y border-marketing-border">
						{positions.map((position) => (
							<div
								key={position.title}
								className="flex flex-col justify-between gap-4 py-6 sm:flex-row sm:items-center"
							>
								<div className="flex-1">
									<div className="flex items-center gap-3">
										<h3 className="font-semibold text-marketing-fg">
											{position.title}
										</h3>
										<span className="inline-flex rounded-full bg-marketing-card-hover px-2 py-0.5 text-xs font-medium text-marketing-fg-hover">
											{position.department}
										</span>
									</div>
									<p className="mt-1 text-sm text-marketing-fg-muted">
										{position.description}
									</p>
									<div className="mt-2 flex gap-4 text-sm text-marketing-fg-subtle">
										<span>{position.type}</span>
										<span>{position.location}</span>
									</div>
								</div>
								<div className="shrink-0">
									<Link
										href="/contact"
										className={cn(
											"inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
											"bg-marketing-card-hover text-marketing-fg hover:bg-marketing-accent/15",
											"dark:bg-marketing-card-hover",
										)}
									>
										Apply
									</Link>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-16" id="cta">
				<div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
					<div className="flex flex-col gap-6">
						<div className="flex max-w-4xl flex-col gap-2">
							<h2
								className={cn(
									"text-pretty font-display text-[2rem] leading-10 tracking-tight",
									"text-marketing-fg",
									"sm:text-5xl sm:leading-14",
								)}
							>
								Don't see the right role?
							</h2>
						</div>
						<div className="max-w-3xl text-base leading-7 text-marketing-fg-muted text-pretty">
							<p>
								We're always looking for talented people. Send us your resume
								and tell us how you'd like to contribute.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<Link
							href="/contact"
							className={cn(
								"inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
								"bg-marketing-accent text-white hover:bg-marketing-accent-hover",
								"dark:bg-marketing-accent",
							)}
						>
							Get in touch
						</Link>
						<Link
							href="/about"
							className={cn(
								"group inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
								"text-marketing-fg hover:bg-marketing-card-hover",
								"dark:hover:bg-white/10",
							)}
						>
							Learn about us
							<ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
						</Link>
					</div>
				</div>
			</section>
		</>
	);
}
