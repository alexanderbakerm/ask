import "server-only";

import { TRPCError } from "@trpc/server";
import { billingConfig, type PlanLimits } from "@/config/billing.config";
import { DEFAULT_PLAN_LIMITS, getPlanById } from "@/lib/billing/plans";
import { SubscriptionStatus } from "@/lib/db/schema/enums";
import { logger } from "@/lib/logger";
import {
	getActivePlanForOrganization,
	getActiveSubscriptionByOrganizationId,
} from "./queries";
import { isStripeConfigured } from "./stripe";

/**
 * Grace period configuration for past_due subscriptions.
 * After this many days, past_due subscriptions will be treated as inactive.
 * Set to 0 to disable grace period (immediate access revocation).
 * Set to -1 for unlimited grace (never revoke access for past_due).
 *
 * Stripe typically retries failed payments for ~3-4 weeks before marking as unpaid.
 * A 7-day grace period on top gives users time to fix payment issues.
 */
const GRACE_PERIOD_DAYS: number = 7;

/**
 * Guard that ensures an organization has an active paid subscription.
 * Use this in tRPC procedures to protect premium features.
 *
 * @throws TRPCError with FORBIDDEN code if no active subscription
 */
export async function requirePaidPlan(
	organizationId: string,
): Promise<{ planId: string; planName: string }> {
	// Skip check if billing is not enabled
	if (!billingConfig.enabled || !isStripeConfigured()) {
		return { planId: "free", planName: "Free" };
	}

	const activePlan = await getActivePlanForOrganization(organizationId);

	if (!activePlan || activePlan.planId === "free") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `This feature requires a paid subscription. Current plan: ${activePlan?.planId ?? "free"}. Please upgrade your plan.`,
		});
	}

	return {
		planId: activePlan.planId,
		planName: activePlan.planName,
	};
}

/**
 * Guard that ensures an organization has a specific plan or higher.
 * Useful for tiered feature access.
 *
 * @param organizationId - The organization ID to check
 * @param requiredPlanIds - Array of plan IDs that are allowed
 * @throws TRPCError with FORBIDDEN code if plan doesn't match
 */
export async function requireSpecificPlan(
	organizationId: string,
	requiredPlanIds: string[],
): Promise<{ planId: string; planName: string }> {
	// Skip check if billing is not enabled
	if (!billingConfig.enabled || !isStripeConfigured()) {
		return { planId: "free", planName: "Free" };
	}

	const activePlan = await getActivePlanForOrganization(organizationId);

	if (!activePlan || !requiredPlanIds.includes(activePlan.planId)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `This feature requires one of the following plans: ${requiredPlanIds.join(", ")}. Current plan: ${activePlan?.planId ?? "free"}.`,
		});
	}

	return {
		planId: activePlan.planId,
		planName: activePlan.planName,
	};
}

/**
 * Get the plan limits for an organization.
 * Returns the limits from the plan config, or default limits if no active plan.
 */
export async function getOrganizationPlanLimits(
	organizationId: string,
): Promise<PlanLimits> {
	// Skip check if billing is not enabled
	if (!billingConfig.enabled || !isStripeConfigured()) {
		return getPlanById("free")?.limits ?? DEFAULT_PLAN_LIMITS;
	}

	const activePlan = await getActivePlanForOrganization(organizationId);

	if (!activePlan) {
		return getPlanById("free")?.limits ?? DEFAULT_PLAN_LIMITS;
	}

	const planConfig = getPlanById(activePlan.planId);
	return planConfig?.limits ?? DEFAULT_PLAN_LIMITS;
}

/**
 * Check if an organization has exceeded their member limit.
 * Returns true if the limit is exceeded.
 */
export async function isOverMemberLimit(
	organizationId: string,
	currentMemberCount: number,
): Promise<boolean> {
	const limits = await getOrganizationPlanLimits(organizationId);

	// -1 means unlimited
	if (limits.maxMembers === -1) {
		return false;
	}

	return currentMemberCount >= limits.maxMembers;
}

/**
 * Check if an organization can add more members.
 * Throws an error if the limit would be exceeded.
 */
export async function requireMemberSlot(
	organizationId: string,
	currentMemberCount: number,
): Promise<void> {
	const isOver = await isOverMemberLimit(organizationId, currentMemberCount);

	if (isOver) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"You have reached the maximum number of team members for your plan. Please upgrade to add more members.",
		});
	}
}

/**
 * Check if an organization needs to choose a plan before accessing the app.
 * Returns true if the organization should be redirected to the choose-plan page.
 *
 * This is used in layouts/pages to gate access when:
 * - Billing is enabled
 * - There is no free plan configured
 * - The organization has no active paid plan
 */
export async function shouldRedirectToChoosePlan(
	organizationId: string,
): Promise<boolean> {
	// If billing is not enabled, no need to choose plan
	if (!billingConfig.enabled) {
		return false;
	}

	// Check if there's a free plan - if yes, users don't need to choose
	const hasFreePlan = Object.values(billingConfig.plans).some(
		(plan) => "isFree" in plan && plan.isFree,
	);

	if (hasFreePlan) {
		return false;
	}

	// No free plan - check if organization has an active paid plan
	try {
		const activePlan = await getActivePlanForOrganization(organizationId);
		return !activePlan;
	} catch (error) {
		// If we can't check, don't block - let checkout fail if there's an issue
		logger.warn(
			{ error, organizationId },
			"Failed to check plan status in shouldRedirectToChoosePlan",
		);
		return false;
	}
}

/**
 * Check if a subscription is within its grace period.
 * Returns detailed information about the payment status.
 *
 * Grace period logic:
 * - `active` and `trialing`: No grace period needed, full access
 * - `past_due`: In grace period, calculate days remaining
 * - `unpaid`, `canceled`, etc.: Grace period expired, no access
 *
 * @param organizationId - The organization ID to check
 */
export async function getPaymentStatus(organizationId: string): Promise<{
	hasAccess: boolean;
	status: "ok" | "grace_period" | "payment_required" | "no_subscription";
	subscriptionStatus: SubscriptionStatus | null;
	gracePeriodDaysRemaining: number | null;
	message: string;
}> {
	// Skip check if billing is not enabled
	if (!billingConfig.enabled || !isStripeConfigured()) {
		return {
			hasAccess: true,
			status: "ok",
			subscriptionStatus: null,
			gracePeriodDaysRemaining: null,
			message: "Billing not enabled",
		};
	}

	const subscription =
		await getActiveSubscriptionByOrganizationId(organizationId);

	if (!subscription) {
		return {
			hasAccess: false,
			status: "no_subscription",
			subscriptionStatus: null,
			gracePeriodDaysRemaining: null,
			message: "No active subscription found",
		};
	}

	const status = subscription.status as SubscriptionStatus;

	// Active and trialing have full access
	if (
		status === SubscriptionStatus.active ||
		status === SubscriptionStatus.trialing
	) {
		return {
			hasAccess: true,
			status: "ok",
			subscriptionStatus: status,
			gracePeriodDaysRemaining: null,
			message: "Subscription active",
		};
	}

	// Past due - check grace period
	if (status === SubscriptionStatus.pastDue) {
		// Unlimited grace period
		if (GRACE_PERIOD_DAYS === -1) {
			return {
				hasAccess: true,
				status: "grace_period",
				subscriptionStatus: status,
				gracePeriodDaysRemaining: null,
				message: "Payment past due - please update payment method",
			};
		}

		// No grace period
		if (GRACE_PERIOD_DAYS === 0) {
			return {
				hasAccess: false,
				status: "payment_required",
				subscriptionStatus: status,
				gracePeriodDaysRemaining: 0,
				message: "Payment required - subscription suspended",
			};
		}

		// Calculate grace period based on when status changed
		// We use currentPeriodEnd as an approximation since that's when payment was due
		const periodEnd = subscription.currentPeriodEnd
			? new Date(subscription.currentPeriodEnd)
			: new Date();
		const gracePeriodEnd = new Date(periodEnd);
		gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

		const now = new Date();
		const daysRemaining = Math.ceil(
			(gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);

		if (daysRemaining > 0) {
			return {
				hasAccess: true,
				status: "grace_period",
				subscriptionStatus: status,
				gracePeriodDaysRemaining: daysRemaining,
				message: `Payment past due - ${daysRemaining} days remaining to update payment`,
			};
		}

		// Grace period expired
		return {
			hasAccess: false,
			status: "payment_required",
			subscriptionStatus: status,
			gracePeriodDaysRemaining: 0,
			message: "Grace period expired - please update payment method",
		};
	}

	// Incomplete - initial payment pending (e.g., 3D Secure)
	if (status === SubscriptionStatus.incomplete) {
		return {
			hasAccess: true, // Allow access while waiting for payment confirmation
			status: "grace_period",
			subscriptionStatus: status,
			gracePeriodDaysRemaining: null,
			message: "Payment confirmation pending",
		};
	}

	// All other statuses (unpaid, canceled, incomplete_expired, paused)
	return {
		hasAccess: false,
		status: "payment_required",
		subscriptionStatus: status,
		gracePeriodDaysRemaining: 0,
		message: "Subscription inactive - please renew or update payment",
	};
}

/**
 * Guard that ensures the organization's subscription is in good standing.
 * Unlike requirePaidPlan, this also checks payment status and grace periods.
 *
 * @throws TRPCError with PAYMENT_REQUIRED code if payment is needed
 */
export async function requireGoodStanding(
	organizationId: string,
): Promise<void> {
	const paymentStatus = await getPaymentStatus(organizationId);

	if (!paymentStatus.hasAccess) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: paymentStatus.message,
		});
	}
}

/**
 * Get the current plan info for display purposes.
 * This is a safe function that won't throw - returns free plan if no active plan.
 */
export async function getCurrentPlanInfo(organizationId: string): Promise<{
	planId: string;
	planName: string;
	isFreePlan: boolean;
	isTrialing: boolean;
	limits: PlanLimits;
}> {
	// Skip check if billing is not enabled
	if (!billingConfig.enabled || !isStripeConfigured()) {
		return {
			planId: "free",
			planName: "Free",
			isFreePlan: true,
			isTrialing: false,
			limits: getPlanById("free")?.limits ?? DEFAULT_PLAN_LIMITS,
		};
	}

	const activePlan = await getActivePlanForOrganization(organizationId);

	if (!activePlan) {
		return {
			planId: "free",
			planName: "Free",
			isFreePlan: true,
			isTrialing: false,
			limits: getPlanById("free")?.limits ?? DEFAULT_PLAN_LIMITS,
		};
	}

	const planConfig = getPlanById(activePlan.planId);

	return {
		planId: activePlan.planId,
		planName: activePlan.planName,
		isFreePlan: activePlan.planId === "free",
		isTrialing: activePlan.isTrialing,
		limits: planConfig?.limits ?? DEFAULT_PLAN_LIMITS,
	};
}
