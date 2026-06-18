"use client";

import { useState } from "react";
import { PricingCard } from "@/components/billing/pricing-card";
import type { PlanDisplay } from "@/lib/billing/types";
import { calculateYearlySavingsPercent } from "@/lib/billing/utils";
import { cn } from "@/lib/utils";

export interface PricingTableProps {
	plans: PlanDisplay[];
	currentPlanId?: string | null;
	onSelectPlan?: (priceId: string) => void;
	loadingPriceId?: string | null;
	showFreePlans?: boolean;
	showEnterprisePlans?: boolean;
	defaultInterval?: "month" | "year";
	className?: string;
	yearlySavingsPercent?: number;
	enterpriseContactEmail?: string;
}

export function PricingTable({
	plans,
	currentPlanId,
	onSelectPlan,
	loadingPriceId,
	showFreePlans = false,
	showEnterprisePlans = true,
	defaultInterval = "month",
	className,
	yearlySavingsPercent = calculateYearlySavingsPercent(),
	enterpriseContactEmail,
}: PricingTableProps) {
	const [selectedInterval, setSelectedInterval] = useState<"month" | "year">(
		defaultInterval,
	);

	// Filter plans based on settings
	const filteredPlans = plans.filter((plan) => {
		if (plan.isFree && !showFreePlans) return false;
		if (plan.isEnterprise && !showEnterprisePlans) return false;
		return true;
	});

	// Check if we have both monthly and yearly prices to show the toggle
	// Use filteredPlans to only consider visible plans
	const hasMonthlyPrices = filteredPlans.some((plan) =>
		plan.prices?.some((p) => p.type === "recurring" && p.interval === "month"),
	);
	const hasYearlyPrices = filteredPlans.some((plan) =>
		plan.prices?.some((p) => p.type === "recurring" && p.interval === "year"),
	);
	const showIntervalToggle = hasMonthlyPrices && hasYearlyPrices;

	return (
		<div
			className={cn(
				"flex flex-col space-y-8 animate-in fade-in duration-300",
				className,
			)}
		>
			{/* Interval Toggle */}
			{showIntervalToggle && (
				<div className="flex justify-center">
					<div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
						<button
							type="button"
							onClick={() => setSelectedInterval("month")}
							className={cn(
								"cursor-pointer rounded-full px-4 py-1 text-sm font-medium leading-7 transition-colors",
								selectedInterval === "month"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:bg-background/50 hover:text-foreground",
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
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:bg-background/50 hover:text-foreground",
							)}
						>
							Yearly
							{yearlySavingsPercent > 0 && (
								<span className="text-[10px] font-semibold text-primary">
									-{yearlySavingsPercent}%
								</span>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Pricing Cards Grid */}
			{filteredPlans.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No plans available
				</p>
			) : (
				<div
					className={cn(
						"grid gap-4",
						filteredPlans.length === 1 && "mx-auto max-w-md",
						filteredPlans.length === 2 && "mx-auto max-w-2xl md:grid-cols-2",
						filteredPlans.length === 3 && "md:grid-cols-2 lg:grid-cols-3",
						filteredPlans.length >= 4 &&
							"md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
					)}
				>
					{filteredPlans.map((plan) => (
						<PricingCard
							key={plan.id}
							plan={plan}
							selectedInterval={selectedInterval}
							currentPlanId={currentPlanId}
							onSelect={onSelectPlan}
							loadingPriceId={loadingPriceId}
							enterpriseContactEmail={enterpriseContactEmail}
						/>
					))}
				</div>
			)}
		</div>
	);
}
