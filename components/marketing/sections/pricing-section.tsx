"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { appConfig } from "@/config/app.config";
import { billingConfig } from "@/config/billing.config";
import type { PlanDisplay } from "@/lib/billing/types";
import {
	calculateYearlySavingsPercent,
	formatCurrency,
	formatInterval,
	getPlansForPricingTable,
} from "@/lib/billing/utils";
import { cn } from "@/lib/utils";

interface PricingCardProps {
	plan: PlanDisplay;
	selectedInterval: "month" | "year";
	onSelect?: (priceId: string) => void;
	loadingPriceId?: string | null;
	currentPlanId?: string | null;
	enterpriseContactEmail?: string;
}

function PricingCard({
	plan,
	selectedInterval,
	onSelect,
	loadingPriceId,
	currentPlanId,
	enterpriseContactEmail = appConfig.contact.email,
}: PricingCardProps) {
	const isCurrentPlan = currentPlanId === plan.id;
	const isPopular = plan.recommended;

	// Find the price for the selected interval (or first available)
	const selectedPrice =
		plan.prices.find(
			(p) => p.type === "recurring" && p.interval === selectedInterval,
		) ?? plan.prices[0];

	const renderPrice = () => {
		if (plan.isFree) {
			return (
				<p className="mt-1 inline-flex gap-1 text-base leading-7">
					<span className="text-marketing-fg">
						{formatCurrency(0, billingConfig.defaultCurrency)}
					</span>
					<span className="text-marketing-fg-subtle">
						{formatInterval("month")}
					</span>
				</p>
			);
		}
		if (plan.isEnterprise) {
			return (
				<p className="mt-1 text-base leading-7 text-marketing-fg">Custom</p>
			);
		}
		if (selectedPrice) {
			return (
				<div className="mt-1 flex flex-col">
					<p className="inline-flex items-baseline gap-1 text-base leading-7">
						<span className="text-marketing-fg">
							{formatCurrency(selectedPrice.amount, selectedPrice.currency)}
						</span>
						<span className="text-marketing-fg-subtle">
							{selectedPrice.type === "recurring"
								? formatInterval(selectedPrice.interval)
								: "one-time"}
						</span>
					</p>
				</div>
			);
		}
		return null;
	};

	const renderButton = () => {
		if (isCurrentPlan) {
			return (
				<button
					type="button"
					disabled
					className={cn(
						"inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
						"bg-marketing-card-hover text-marketing-fg/50-hover/50",
						"cursor-not-allowed",
					)}
				>
					Current Plan
				</button>
			);
		}
		if (plan.isEnterprise) {
			return (
				<Link
					href={`mailto:${enterpriseContactEmail}`}
					className={cn(
						"inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
						"bg-marketing-card-hover text-marketing-fg",
					)}
				>
					Contact Sales
				</Link>
			);
		}
		if (plan.isFree) {
			return (
				<Link
					href="/auth/sign-up"
					className={cn(
						"inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
						"bg-marketing-card-hover text-marketing-fg",
					)}
				>
					Get Started Free
				</Link>
			);
		}
		if (selectedPrice && onSelect) {
			const isLoading = loadingPriceId === selectedPrice.stripePriceId;
			const isDisabled =
				!!loadingPriceId && loadingPriceId !== selectedPrice.stripePriceId;
			return (
				<button
					type="button"
					onClick={() => onSelect(selectedPrice.stripePriceId)}
					disabled={isDisabled || isLoading}
					className={cn(
						"inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
						isPopular
							? "bg-marketing-accent text-marketing-accent-fg hover:bg-marketing-accent-hover"
							: "bg-marketing-card-hover text-marketing-fg",
						(isDisabled || isLoading) && "cursor-not-allowed opacity-50",
					)}
				>
					{isLoading
						? "Loading..."
						: currentPlanId
							? "Upgrade"
							: "Start free trial"}
				</button>
			);
		}
		// Default link button (no onSelect handler)
		return (
			<Link
				href="/auth/sign-up"
				className={cn(
					"inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
					isPopular
						? "bg-marketing-accent text-marketing-accent-fg hover:bg-marketing-accent-hover"
						: "bg-marketing-card-hover text-marketing-fg",
				)}
			>
				Start free trial
			</Link>
		);
	};

	return (
		<div
			className={cn(
				"flex flex-col justify-between gap-6 rounded-xl bg-marketing-card p-6 sm:items-start",
				isCurrentPlan && "opacity-60",
			)}
		>
			<div className="self-stretch">
				<div className="flex items-center justify-between">
					{isPopular && (
						<div className="order-last inline-flex rounded-full bg-marketing-card-hover px-2 py-1 text-xs font-medium text-marketing-fg-hover">
							Most popular
						</div>
					)}
					<h3 className="text-2xl leading-8 tracking-tight text-marketing-fg">
						{plan.name}
					</h3>
				</div>

				{renderPrice()}

				<div className="mt-4 flex flex-col gap-4 text-sm leading-6 text-marketing-fg-muted">
					<p>{plan.description}</p>
				</div>

				<ul className="mt-4 space-y-2 text-sm leading-6 text-marketing-fg-muted">
					{selectedPrice?.trialDays && (
						<li className="flex gap-4">
							<CheckIcon className="mt-0.5 size-3.5 shrink-0 stroke-marketing-fg dark:stroke-white" />
							<p>{selectedPrice.trialDays}-day free trial</p>
						</li>
					)}
					{plan.features.map((feature) => (
						<li key={feature} className="flex gap-4">
							<CheckIcon className="mt-0.5 size-3.5 shrink-0 stroke-marketing-fg dark:stroke-white" />
							<p>{feature}</p>
						</li>
					))}
				</ul>
			</div>

			{renderButton()}
		</div>
	);
}

interface PricingSectionProps {
	headline?: string;
	/** Called when user selects a plan */
	onSelectPlan?: (priceId: string) => void;
	/** Price ID currently being processed */
	loadingPriceId?: string | null;
	/** Currently active plan ID */
	currentPlanId?: string | null;
	/** Show free plans */
	showFreePlans?: boolean;
	/** Show enterprise plans */
	showEnterprisePlans?: boolean;
	/** Default billing interval */
	defaultInterval?: "month" | "year";
	/** Email for enterprise contact */
	enterpriseContactEmail?: string;
	/** Optionally provide plans directly instead of fetching them */
	plans?: PlanDisplay[];
	/** Hide the headline section */
	hideHeadline?: boolean;
}

export function PricingSection({
	headline = "Pricing to fit your business needs.",
	onSelectPlan,
	loadingPriceId,
	currentPlanId,
	showFreePlans = true,
	showEnterprisePlans = false,
	defaultInterval = "month",
	enterpriseContactEmail = appConfig.contact.email,
	plans: providedPlans,
	hideHeadline = false,
}: PricingSectionProps) {
	const allPlans = providedPlans ?? getPlansForPricingTable();
	const [selectedInterval, setSelectedInterval] = useState<"month" | "year">(
		defaultInterval,
	);

	// Filter plans based on settings
	const plans = allPlans.filter((plan) => {
		if (plan.isFree && !showFreePlans) return false;
		if (plan.isEnterprise && !showEnterprisePlans) return false;
		return true;
	});

	// Check if we have both monthly and yearly prices
	const hasMonthlyPrices = plans.some((plan) =>
		plan.prices?.some((p) => p.type === "recurring" && p.interval === "month"),
	);
	const hasYearlyPrices = plans.some((plan) =>
		plan.prices?.some((p) => p.type === "recurring" && p.interval === "year"),
	);
	const showIntervalToggle = hasMonthlyPrices && hasYearlyPrices;
	const savingsPercent = calculateYearlySavingsPercent();

	return (
		<section
			id="pricing"
			className={cn(hideHeadline ? "" : "pb-16", "scroll-mt-14")}
		>
			<div
				className={cn(
					"flex flex-col gap-10 lg:gap-16",
					!hideHeadline &&
						"mx-auto max-w-2xl px-6 md:max-w-3xl lg:max-w-7xl lg:px-10",
				)}
			>
				{/* Header */}
				{!hideHeadline && (
					<div className="flex max-w-2xl flex-col gap-6">
						<div className="flex flex-col gap-2">
							<h2
								className={cn(
									"text-pretty font-display text-[2rem] leading-10 tracking-tight",
									"text-marketing-fg",
									"sm:text-5xl sm:leading-14",
								)}
							>
								{headline}
							</h2>
						</div>
					</div>
				)}

				{/* Interval Toggle */}
				{showIntervalToggle && (
					<div className="flex items-center justify-center">
						<div className="inline-flex items-center gap-1 rounded-full bg-marketing-card p-1">
							<button
								type="button"
								onClick={() => setSelectedInterval("month")}
								className={cn(
									"cursor-pointer rounded-full px-4 py-1 text-sm font-medium leading-7 transition-colors",
									selectedInterval === "month"
										? "bg-marketing-accent text-marketing-accent-fg"
										: "text-marketing-fg hover:bg-marketing-card-hover",
								)}
							>
								Monthly
							</button>
							<button
								type="button"
								onClick={() => setSelectedInterval("year")}
								className={cn(
									"inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-1 text-sm font-medium leading-7 transition-colors",
									selectedInterval === "year"
										? "bg-marketing-accent text-marketing-accent-fg"
										: "text-marketing-fg hover:bg-marketing-card-hover",
								)}
							>
								Yearly
								{savingsPercent > 0 && (
									<span className="text-[10px] font-semibold opacity-70">
										-{savingsPercent}%
									</span>
								)}
							</button>
						</div>
					</div>
				)}

				{/* Pricing Cards */}
				{plans.length === 0 ? (
					<p className="py-8 text-center text-marketing-fg-muted text-sm">
						No plans available
					</p>
				) : (
					<div
						className={cn(
							"grid gap-4",
							plans.length === 1 && "mx-auto max-w-md grid-cols-1",
							plans.length === 2 &&
								"mx-auto max-w-2xl grid-cols-1 md:grid-cols-2",
							plans.length === 3 && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
							plans.length >= 4 &&
								"grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
						)}
					>
						{plans.map((plan) => (
							<PricingCard
								key={plan.id}
								plan={plan}
								selectedInterval={selectedInterval}
								onSelect={onSelectPlan}
								loadingPriceId={loadingPriceId}
								currentPlanId={currentPlanId}
								enterpriseContactEmail={enterpriseContactEmail}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
