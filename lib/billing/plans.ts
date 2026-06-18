import {
	billingConfig,
	type Plan,
	type PlanLimits,
	type PriceConfig,
} from "@/config/billing.config";

/**
 * Default plan limits used when no plan is active or limits are not defined.
 * This matches the free plan limits and serves as a fallback.
 */
export const DEFAULT_PLAN_LIMITS: PlanLimits = {
	maxMembers: 3,
	maxStorage: 1, // GB
};

/**
 * Get a plan by its ID.
 */
export function getPlanById(planId: string): Plan | undefined {
	const plans = billingConfig.plans as Record<string, Plan>;
	return plans[planId];
}

/**
 * Get a price configuration by its Stripe price ID.
 * Returns both the plan and price config if found.
 */
export function getPriceByStripePriceId(stripePriceId: string): {
	plan: Plan;
	price: PriceConfig;
} | null {
	const plans = Object.values(billingConfig.plans) as Plan[];
	for (const plan of plans) {
		if ("prices" in plan && plan.prices) {
			const price = plan.prices.find(
				(p: PriceConfig) => p.stripePriceId === stripePriceId,
			);
			if (price) {
				return { plan, price };
			}
		}
	}
	return null;
}

/**
 * Get a plan by its Stripe price ID.
 */
export function getPlanByStripePriceId(stripePriceId: string): Plan | null {
	const result = getPriceByStripePriceId(stripePriceId);
	return result?.plan ?? null;
}

/**
 * Get all paid plans (excluding free and enterprise plans).
 */
export function getPaidPlans(): Plan[] {
	const plans = Object.values(billingConfig.plans) as Plan[];
	return plans.filter(
		(plan) =>
			!("isFree" in plan && plan.isFree) &&
			!("isEnterprise" in plan && plan.isEnterprise) &&
			"prices" in plan,
	);
}

/**
 * Get the free plan if one exists.
 */
export function getFreePlan(): Plan | undefined {
	const plans = Object.values(billingConfig.plans) as Plan[];
	return plans.find((plan) => "isFree" in plan && plan.isFree === true);
}

/**
 * Get all plan IDs.
 */
export function getAllPlanIds(): string[] {
	return Object.keys(billingConfig.plans);
}
