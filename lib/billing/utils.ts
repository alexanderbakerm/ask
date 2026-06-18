import { billingConfig } from "@/config/billing.config";

/**
 * Billing utility functions for UI components
 */

/**
 * Transform the billing plans from app config to the format expected by PricingTable
 */
export function getPlansForPricingTable() {
	const plans = billingConfig.plans;

	return Object.entries(plans).map(([id, plan]) => {
		const prices =
			"prices" in plan && plan.prices
				? plan.prices.map((price) => ({
						id: price.id,
						stripePriceId: price.stripePriceId,
						type: price.type,
						amount: price.amount,
						currency: price.currency,
						interval: "interval" in price ? price.interval : null,
						intervalCount:
							"intervalCount" in price ? price.intervalCount : null,
						trialDays: "trialDays" in price ? price.trialDays : null,
					}))
				: [];

		return {
			id,
			name: plan.name,
			description: plan.description,
			features: plan.features,
			prices,
			isFree: "isFree" in plan ? Boolean(plan.isFree) : false,
			isEnterprise: "isEnterprise" in plan ? Boolean(plan.isEnterprise) : false,
			recommended: "recommended" in plan ? Boolean(plan.recommended) : false,
		};
	});
}

/**
 * Calculate the actual yearly savings percentage based on plan prices
 */
export function calculateYearlySavingsPercent(): number {
	const plans = billingConfig.plans;

	for (const plan of Object.values(plans)) {
		if ("prices" in plan && plan.prices) {
			const monthlyPrice = plan.prices.find(
				(p) =>
					p.type === "recurring" && "interval" in p && p.interval === "month",
			);
			const yearlyPrice = plan.prices.find(
				(p) =>
					p.type === "recurring" && "interval" in p && p.interval === "year",
			);

			if (monthlyPrice && yearlyPrice) {
				const yearlyIfPaidMonthly = monthlyPrice.amount * 12;
				const savings =
					((yearlyIfPaidMonthly - yearlyPrice.amount) / yearlyIfPaidMonthly) *
					100;
				return Math.round(savings);
			}
		}
	}

	return 0;
}

/**
 * Format a currency amount for display.
 * Uses the user's locale for proper number formatting.
 *
 * @param amount - Amount in cents (e.g., 2900 = $29.00)
 * @param currency - ISO 4217 currency code (e.g., "usd", "eur")
 * @returns Formatted currency string (e.g., "$29.00")
 */
export function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(amount / 100);
}

/**
 * Format a billing interval for display.
 *
 * @param interval - The billing interval
 * @returns Formatted interval string (e.g., "/mo", "/yr")
 */
export function formatInterval(
	interval?: "month" | "year" | "week" | "day" | string | null,
): string {
	const labels: Record<string, string> = {
		month: "/mo",
		year: "/yr",
		week: "/wk",
		day: "/day",
	};
	return interval ? (labels[interval] ?? "") : "";
}
