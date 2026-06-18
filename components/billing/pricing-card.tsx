"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { appConfig } from "@/config/app.config";
import { billingConfig } from "@/config/billing.config";
import type { PlanDisplay } from "@/lib/billing/types";
import { formatCurrency, formatInterval } from "@/lib/billing/utils";
import { cn } from "@/lib/utils";

interface PricingCardProps {
	plan: PlanDisplay;
	selectedInterval: "month" | "year";
	onSelect?: (priceId: string) => void;
	loadingPriceId?: string | null;
	currentPlanId?: string | null;
	enterpriseContactEmail?: string;
}

export function PricingCard({
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
					<span className="text-foreground">
						{formatCurrency(0, billingConfig.defaultCurrency)}
					</span>
					<span className="text-muted-foreground">
						{formatInterval("month")}
					</span>
				</p>
			);
		}
		if (plan.isEnterprise) {
			return <p className="mt-1 text-base leading-7 text-foreground">Custom</p>;
		}
		if (selectedPrice) {
			return (
				<div className="mt-1 flex flex-col">
					<p className="inline-flex items-baseline gap-1 text-base leading-7">
						<span className="text-foreground">
							{formatCurrency(selectedPrice.amount, selectedPrice.currency)}
						</span>
						<span className="text-muted-foreground">
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
						"cursor-not-allowed bg-muted text-muted-foreground",
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
						"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
					)}
				>
					Contact Sales
				</Link>
			);
		}
		if (plan.isFree) {
			// In settings context, usually you can't downgrade to free easily via checkout, but let's assume 'Downgrade' if not current?
			// Actually typical flow for free in settings is just "Current Plan" if active, or hidden if not relevant (e.g. upgrades only).
			// If we are showing it and it's not current, maybe they are on paid and want to downgrade? Downgrade usually requires specific flow.
			// For now, let's just show "Free" button disabled or similar if logic is complex, or "Downgrade" if we supported it.
			// Based on existing code, it seems simpler.
			return (
				<button
					type="button"
					disabled
					className={cn(
						"inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
						"cursor-not-allowed bg-muted text-muted-foreground",
					)}
				>
					Free Plan
				</button>
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
							? "bg-primary text-primary-foreground hover:bg-primary/90"
							: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
						(isDisabled || isLoading) && "cursor-not-allowed opacity-50",
					)}
				>
					{isLoading ? "Loading..." : currentPlanId ? "Upgrade" : "Subscribe"}
				</button>
			);
		}
		return null;
	};

	return (
		<div
			className={cn(
				"flex flex-col justify-between gap-6 rounded-xl border p-6 sm:items-start",
				// Dark mode styling request: darker bg or borders
				"bg-card text-card-foreground dark:bg-neutral-950/50",
				isCurrentPlan && "opacity-60",
			)}
		>
			<div className="self-stretch">
				<div className="flex items-center justify-between">
					{isPopular && (
						<div className="order-last inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
							Most popular
						</div>
					)}
					<h3 className="text-2xl leading-8 tracking-tight text-foreground">
						{plan.name}
					</h3>
				</div>

				{renderPrice()}

				<div className="mt-4 flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
					<p>{plan.description}</p>
				</div>

				<ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
					{selectedPrice?.trialDays && (
						<li className="flex gap-4">
							<CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
							<p>{selectedPrice.trialDays}-day free trial</p>
						</li>
					)}
					{plan.features.map((feature) => (
						<li key={feature} className="flex gap-4">
							<CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
							<p>{feature}</p>
						</li>
					))}
				</ul>
			</div>

			{renderButton()}
		</div>
	);
}
