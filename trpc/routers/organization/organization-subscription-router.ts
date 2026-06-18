import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import { billingConfig } from "@/config/billing.config";
import {
	cancelSubscriptionAtPeriodEnd,
	changeSubscriptionPrice,
	createCheckoutSession,
	createCustomerPortalSession,
	getActivePlanForOrganization,
	getActiveSubscriptionByOrganizationId,
	getOrCreateStripeCustomer,
	getOrderItemsByOrderId,
	getOrdersByOrganizationId,
	getStripeCustomerByOrganizationId,
	getSubscriptionsByOrganizationId,
	isStripeConfigured,
	listCustomerInvoices,
	previewSubscriptionChange,
	reactivateSubscription,
	safeTsToDate,
	updateSubscription,
	updateSubscriptionQuantity,
} from "@/lib/billing";
import { getPlanById, getPriceByStripePriceId } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { memberTable, organizationTable } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import {
	createCheckoutSchema,
	createPortalSessionSchema,
	listInvoicesSchema,
	listSubscriptionsSchema,
	planChangeSchema,
	updateSeatsSchema,
} from "@/schemas/organization-subscription-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

/**
 * Helper to get organization with stripeCustomerId from database
 */
async function getOrganizationWithBilling(organizationId: string) {
	return db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, organizationId),
		columns: {
			id: true,
			name: true,
			stripeCustomerId: true,
		},
	});
}

/**
 * Organization Subscription router
 * Handles all subscription and billing-related operations for organizations
 */
export const organizationSubscriptionRouter = createTRPCRouter({
	/**
	 * Get the current billing status for the organization
	 * Returns the active plan, subscription status, etc.
	 */
	getStatus: protectedOrganizationProcedure.query(async ({ ctx }) => {
		// Check if billing is disabled in config
		if (!billingConfig.enabled) {
			return {
				enabled: false,
				disabledReason: "disabled" as const,
				activePlan: null,
				subscription: null,
			};
		}

		// Check if Stripe is not configured (missing env vars)
		if (!isStripeConfigured()) {
			return {
				enabled: false,
				disabledReason: "not_configured" as const,
				activePlan: null,
				subscription: null,
			};
		}

		const { organization } = ctx;

		// Fetch subscription first - we need it for both activePlan check and subscription details
		// This avoids the redundant query that was happening before
		const subscription = await getActiveSubscriptionByOrganizationId(
			organization.id,
		);

		// Get org with billing info from database (for stripeCustomerId check)
		const orgWithBilling = await getOrganizationWithBilling(organization.id);

		// Get active plan - pass subscription to avoid re-fetching
		// Note: getActivePlanForOrganization checks subscription first, then lifetime orders
		// Since we already have subscription, we can build activePlan directly for subscription case
		let activePlan = null;
		if (subscription) {
			const plan = getPlanById(
				getPriceByStripePriceId(subscription.stripePriceId)?.plan.id ?? "",
			);
			activePlan = {
				planId: plan?.id ?? "unknown",
				planName: plan?.name ?? "Unknown Plan",
				stripePriceId: subscription.stripePriceId,
				status: subscription.status,
				isTrialing: subscription.status === "trialing",
				trialEndsAt: subscription.trialEnd,
				currentPeriodEnd: subscription.currentPeriodEnd,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
				quantity: subscription.quantity,
				isLifetime: false,
			};
		} else {
			// No subscription - check for lifetime order
			activePlan = await getActivePlanForOrganization(organization.id);
		}

		// Get plan details from config
		const planConfig = activePlan
			? getPlanById(activePlan.planId)
			: getPlanById("free");

		return {
			enabled: true,
			activePlan: activePlan
				? {
						...activePlan,
						features: planConfig?.features ?? [],
						limits: planConfig?.limits ?? null,
					}
				: {
						planId: "free",
						planName: "Free",
						features: getPlanById("free")?.features ?? [],
						limits: getPlanById("free")?.limits ?? null,
						isTrialing: false,
						isLifetime: false,
						cancelAtPeriodEnd: false,
					},
			subscription: subscription
				? {
						id: subscription.id,
						status: subscription.status,
						currentPeriodEnd: subscription.currentPeriodEnd,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
						trialEnd: subscription.trialEnd,
					}
				: null,
			hasStripeCustomer: !!orgWithBilling?.stripeCustomerId,
		};
	}),

	/**
	 * Get all subscriptions (history) for the organization with pagination
	 */
	listSubscriptions: protectedOrganizationProcedure
		.input(listSubscriptionsSchema.optional())
		.query(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				return [];
			}

			const { organization } = ctx;
			const subscriptions = await getSubscriptionsByOrganizationId(
				organization.id,
				{
					limit: input?.limit ?? appConfig.pagination.defaultLimit,
					offset: input?.offset ?? 0,
				},
			);

			return subscriptions.map((sub) => {
				const priceConfig = getPriceByStripePriceId(sub.stripePriceId);
				return {
					...sub,
					planName: priceConfig?.plan.name ?? "Unknown",
					planId: priceConfig?.plan.id ?? "unknown",
				};
			});
		}),

	/**
	 * Get all one-time orders for the organization with pagination
	 */
	listOrders: protectedOrganizationProcedure
		.input(listSubscriptionsSchema.optional())
		.query(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				return [];
			}

			const { organization } = ctx;
			const orders = await getOrdersByOrganizationId(organization.id, {
				limit: input?.limit ?? appConfig.pagination.defaultLimit,
				offset: input?.offset ?? 0,
			});

			// Fetch items for each order to get plan info
			const ordersWithPlanInfo = await Promise.all(
				orders.map(async (order) => {
					const items = await getOrderItemsByOrderId(order.id);
					// Get plan info from first item (most orders have one item)
					const firstItem = items[0];
					const priceConfig = firstItem
						? getPriceByStripePriceId(firstItem.stripePriceId)
						: null;

					return {
						...order,
						items,
						planName: priceConfig?.plan.name ?? "Unknown",
						planId: priceConfig?.plan.id ?? "unknown",
					};
				}),
			);

			return ordersWithPlanInfo;
		}),

	/**
	 * Get invoices from Stripe for the organization
	 */
	listInvoices: protectedOrganizationProcedure
		.input(listInvoicesSchema.optional())
		.query(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				return [];
			}

			const { organization } = ctx;

			// Get org with billing info from database
			const orgWithBilling = await getOrganizationWithBilling(organization.id);

			if (!orgWithBilling?.stripeCustomerId) {
				return [];
			}

			const invoices = await listCustomerInvoices(
				orgWithBilling.stripeCustomerId,
				{
					limit: input?.limit ?? 10,
				},
			);

			return invoices.map((invoice) => ({
				id: invoice.id,
				number: invoice.number,
				status: invoice.status,
				amount: invoice.amount_paid,
				currency: invoice.currency,
				hostedInvoiceUrl: invoice.hosted_invoice_url,
				pdfUrl: invoice.invoice_pdf,
				createdAt: safeTsToDate(invoice.created) ?? new Date(),
			}));
		}),

	/**
	 * Create a checkout session for a subscription or one-time order
	 * Returns the checkout URL to redirect the user to
	 */
	createCheckout: protectedOrganizationProcedure
		.input(createCheckoutSchema)
		.mutation(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, user, membership } = ctx;

			// Only owners and admins can manage billing
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only organization owners and admins can manage billing",
				});
			}

			// Validate the price ID exists in our config
			const priceConfig = getPriceByStripePriceId(input.priceId);
			if (!priceConfig) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid price ID",
				});
			}

			// Check if organization already has an active subscription (for recurring prices)
			if (priceConfig.price.type === "recurring") {
				const existingSubscription =
					await getActiveSubscriptionByOrganizationId(organization.id);
				if (existingSubscription) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Organization already has an active subscription. Use plan change instead.",
					});
				}
			}

			// Check if organization already has an active plan (including lifetime)
			// This prevents buying lifetime twice or buying one-time when subscription exists
			const activePlan = await getActivePlanForOrganization(organization.id);
			if (activePlan) {
				// If they have lifetime, don't allow any order
				if (activePlan.isLifetime) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Organization already has a lifetime plan.",
					});
				}
				// If they're trying to buy a one-time order while having an active subscription, block it
				// This prevents confusion from having both subscription + lifetime
				if (priceConfig.price.type === "one_time") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Cannot purchase a one-time plan while you have an active subscription. Please cancel your subscription first.",
					});
				}
			}

			// Get or create Stripe customer
			const customer = await getOrCreateStripeCustomer({
				organizationId: organization.id,
				organizationName: organization.name,
				email: user.email,
			});

			// Determine URLs
			const baseUrl = appConfig.baseUrl;
			const successUrl =
				input.successUrl ??
				`${baseUrl}/dashboard/organization/settings?tab=subscription&success=true`;
			const cancelUrl =
				input.cancelUrl ??
				`${baseUrl}/dashboard/organization/settings?tab=subscription&canceled=true`;

			// Get trial days from price config
			const trialDays =
				"trialDays" in priceConfig.price
					? priceConfig.price.trialDays
					: undefined;

			// Determine checkout quantity for seat-based plans
			// For seat-based pricing, auto-calculate based on current member count
			// User can provide a higher quantity but not lower than member count
			let checkoutQuantity = input.quantity;
			const isSeatBased =
				"seatBased" in priceConfig.price && priceConfig.price.seatBased;

			if (isSeatBased) {
				// Get current member count
				const members = await db
					.select({ id: memberTable.id })
					.from(memberTable)
					.where(eq(memberTable.organizationId, organization.id));

				const memberCount = Math.max(1, members.length); // At least 1 for the owner

				// Use member count as minimum, allow user to specify more seats
				checkoutQuantity = Math.max(memberCount, input.quantity);

				// If user explicitly provided a lower quantity, warn them
				if (input.quantity > 1 && input.quantity < memberCount) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Cannot checkout with ${input.quantity} seats when you have ${memberCount} team members. Minimum seats required: ${memberCount}.`,
					});
				}
			}

			// Create checkout session
			const { url, sessionId } = await createCheckoutSession({
				organizationId: organization.id,
				stripePriceId: input.priceId,
				stripeCustomerId: customer.id,
				quantity: checkoutQuantity,
				successUrl,
				cancelUrl,
				trialDays,
				metadata: {
					organizationId: organization.id,
					userId: user.id,
				},
			});

			return { url, sessionId };
		}),

	/**
	 * Create a customer portal session
	 * Returns the portal URL to redirect the user to
	 */
	createPortalSession: protectedOrganizationProcedure
		.input(createPortalSessionSchema.optional())
		.mutation(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, membership } = ctx;

			// Only owners and admins can access billing portal
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only organization owners and admins can access billing",
				});
			}

			// Get customer
			const customer = await getStripeCustomerByOrganizationId(organization.id);

			if (!customer) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"No billing account found. Please subscribe to a plan first.",
				});
			}

			const returnUrl =
				input?.returnUrl ??
				`${appConfig.baseUrl}/dashboard/organization/settings?tab=subscription`;

			const { url } = await createCustomerPortalSession({
				stripeCustomerId: customer.id,
				returnUrl,
			});

			return { url };
		}),

	/**
	 * Cancel the current subscription at the end of the billing period
	 */
	cancelSubscription: protectedOrganizationProcedure.mutation(
		async ({ ctx }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, membership } = ctx;

			// Only owners and admins can cancel
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Only organization owners and admins can cancel subscriptions",
				});
			}

			// Get active subscription
			const subscription = await getActiveSubscriptionByOrganizationId(
				organization.id,
			);

			if (!subscription) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No active subscription found",
				});
			}

			// Check if already scheduled for cancellation
			if (subscription.cancelAtPeriodEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Subscription is already scheduled for cancellation",
				});
			}

			// Cancel at period end in Stripe (source of truth)
			await cancelSubscriptionAtPeriodEnd(subscription.id);

			// Update local database to keep it in sync
			// Webhook will also update, but this provides immediate consistency for the UI
			// If DB update fails, Stripe is still the source of truth and webhook will sync
			try {
				await updateSubscription(subscription.id, {
					cancelAtPeriodEnd: true,
				});
			} catch (dbError) {
				// Log but don't throw - Stripe update succeeded, webhook will sync DB
				logger.error(
					{ error: dbError, subscriptionId: subscription.id },
					"Failed to update local DB after Stripe cancel, webhook will sync",
				);
			}

			return { success: true };
		},
	),

	/**
	 * Reactivate a subscription that was scheduled for cancellation
	 */
	reactivateSubscription: protectedOrganizationProcedure.mutation(
		async ({ ctx }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, membership } = ctx;

			// Only owners and admins can reactivate
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Only organization owners and admins can reactivate subscriptions",
				});
			}

			// Get active subscription
			const subscription = await getActiveSubscriptionByOrganizationId(
				organization.id,
			);

			if (!subscription) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No subscription found",
				});
			}

			if (!subscription.cancelAtPeriodEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Subscription is not scheduled for cancellation",
				});
			}

			// Reactivate in Stripe (source of truth)
			await reactivateSubscription(subscription.id);

			// Update local database to keep it in sync
			// Webhook will also update, but this provides immediate consistency for the UI
			// If DB update fails, Stripe is still the source of truth and webhook will sync
			try {
				await updateSubscription(subscription.id, {
					cancelAtPeriodEnd: false,
				});
			} catch (dbError) {
				// Log but don't throw - Stripe update succeeded, webhook will sync DB
				logger.error(
					{ error: dbError, subscriptionId: subscription.id },
					"Failed to update local DB after Stripe reactivate, webhook will sync",
				);
			}

			return { success: true };
		},
	),

	/**
	 * Get available plans from config
	 */
	listPlans: protectedOrganizationProcedure.query(async () => {
		if (!billingConfig.enabled) {
			return { enabled: false, plans: [] };
		}

		const plans = Object.values(billingConfig.plans).map((plan) => ({
			id: plan.id,
			name: plan.name,
			description: plan.description,
			features: plan.features,
			limits: plan.limits ?? null,
			isFree: "isFree" in plan ? (plan.isFree as boolean) : false,
			isEnterprise:
				"isEnterprise" in plan ? (plan.isEnterprise as boolean) : false,
			recommended:
				"recommended" in plan ? (plan.recommended as boolean) : false,
			prices:
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
					: [],
		}));

		return { enabled: true, plans };
	}),

	/**
	 * Preview subscription change (upgrade/downgrade)
	 * Shows the prorated amount and what the user will be charged
	 */
	previewPlanChange: protectedOrganizationProcedure
		.input(planChangeSchema)
		.query(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, membership } = ctx;

			// Only owners and admins can preview changes
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only organization owners and admins can manage billing",
				});
			}

			// Get current subscription
			const subscription = await getActiveSubscriptionByOrganizationId(
				organization.id,
			);

			if (!subscription) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No active subscription to change",
				});
			}

			// Don't allow previewing changes on canceling subscriptions
			if (subscription.cancelAtPeriodEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Cannot preview plan change on a subscription that is scheduled for cancellation",
				});
			}

			// Validate the new price ID
			const newPriceConfig = getPriceByStripePriceId(input.newPriceId);
			if (!newPriceConfig) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid price ID",
				});
			}

			// Check if trying to preview change to same plan
			if (subscription.stripePriceId === input.newPriceId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You are already subscribed to this plan",
				});
			}

			// Get current price config
			const currentPriceConfig = getPriceByStripePriceId(
				subscription.stripePriceId,
			);

			// Preview the change with Stripe
			const preview = await previewSubscriptionChange({
				customerId: subscription.stripeCustomerId,
				subscriptionId: subscription.id,
				newPriceId: input.newPriceId,
				quantity: input.quantity,
			});

			// Calculate if this is an upgrade or downgrade
			const currentAmount = currentPriceConfig?.price.amount ?? 0;
			const newAmount = newPriceConfig.price.amount;
			const isUpgrade = newAmount > currentAmount;

			return {
				currentPlan: {
					id: currentPriceConfig?.plan.id ?? "unknown",
					name: currentPriceConfig?.plan.name ?? "Unknown",
					amount: currentAmount,
					currency: currentPriceConfig?.price.currency ?? "usd",
				},
				newPlan: {
					id: newPriceConfig.plan.id,
					name: newPriceConfig.plan.name,
					amount: newAmount,
					currency: newPriceConfig.price.currency,
				},
				isUpgrade,
				// Proration details from Stripe
				proratedAmount: preview.amount_due,
				immediateCharge: preview.amount_due > 0 ? preview.amount_due : 0,
				credit: preview.amount_due < 0 ? Math.abs(preview.amount_due) : 0,
				currency: preview.currency,
				// Next billing
				nextBillingDate: safeTsToDate(preview.next_payment_attempt),
				// Line items for detailed breakdown
				lineItems: preview.lines.data.map((line) => ({
					description: line.description,
					amount: line.amount,
					quantity: line.quantity,
				})),
			};
		}),

	/**
	 * Change subscription to a different plan (upgrade/downgrade)
	 */
	changePlan: protectedOrganizationProcedure
		.input(planChangeSchema)
		.mutation(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, membership } = ctx;

			// Only owners and admins can change plans
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only organization owners and admins can manage billing",
				});
			}

			// Get current subscription
			const subscription = await getActiveSubscriptionByOrganizationId(
				organization.id,
			);

			if (!subscription) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No active subscription to change",
				});
			}

			// Don't allow plan changes on canceling subscriptions
			if (subscription.cancelAtPeriodEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Cannot change plan on a subscription that is scheduled for cancellation. Reactivate first.",
				});
			}

			// Validate the new price ID
			const newPriceConfig = getPriceByStripePriceId(input.newPriceId);
			if (!newPriceConfig) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid price ID",
				});
			}

			// Check if user is trying to change to the same price
			if (subscription.stripePriceId === input.newPriceId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You are already subscribed to this plan",
				});
			}

			// Change the subscription in Stripe (source of truth)
			await changeSubscriptionPrice(subscription.id, input.newPriceId, {
				quantity: input.quantity,
				prorationBehavior: "create_prorations",
			});

			// Update local database to keep it in sync
			// Webhook will also update, but this provides immediate consistency for the UI
			// If DB update fails, Stripe is still the source of truth and webhook will sync
			try {
				await updateSubscription(subscription.id, {
					stripePriceId: input.newPriceId,
					quantity: input.quantity ?? subscription.quantity,
				});
			} catch (dbError) {
				// Log but don't throw - Stripe update succeeded, webhook will sync DB
				logger.error(
					{ error: dbError, subscriptionId: subscription.id },
					"Failed to update local DB after Stripe plan change, webhook will sync",
				);
			}

			return {
				success: true,
				newPlanId: newPriceConfig.plan.id,
				newPlanName: newPriceConfig.plan.name,
			};
		}),

	/**
	 * Update subscription seat count (for per-seat billing)
	 */
	updateSeats: protectedOrganizationProcedure
		.input(updateSeatsSchema)
		.mutation(async ({ ctx, input }) => {
			if (!billingConfig.enabled || !isStripeConfigured()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Billing is not enabled",
				});
			}

			const { organization, membership } = ctx;

			// Only owners and admins can update seats
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only organization owners and admins can manage billing",
				});
			}

			// Get current subscription
			const subscription = await getActiveSubscriptionByOrganizationId(
				organization.id,
			);

			if (!subscription) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No active subscription found",
				});
			}

			// Don't allow seat changes on canceling subscriptions
			if (subscription.cancelAtPeriodEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Cannot update seats on a subscription that is scheduled for cancellation",
				});
			}

			// Check if the plan supports seat-based billing
			const priceConfig = getPriceByStripePriceId(subscription.stripePriceId);
			if (
				!priceConfig ||
				!("seatBased" in priceConfig.price) ||
				!priceConfig.price.seatBased
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Your current plan does not support per-seat billing",
				});
			}

			// Validate that the new seat count isn't less than current member count
			// Query member count directly to ensure accuracy
			const members = await db
				.select({ id: memberTable.id })
				.from(memberTable)
				.where(eq(memberTable.organizationId, organization.id));
			const currentMemberCount = members.length;

			if (input.quantity < currentMemberCount) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot reduce seats below current member count (${currentMemberCount}). Remove members first before reducing seats.`,
				});
			}

			// Update the subscription quantity in Stripe (source of truth)
			await updateSubscriptionQuantity(subscription.id, input.quantity);

			// Update local database to keep it in sync
			// This is a cache - Stripe is the source of truth, but we update locally
			// for faster reads and to avoid Stripe API calls on every query
			// If DB update fails, Stripe is still the source of truth and webhook will sync
			try {
				await updateSubscription(subscription.id, {
					quantity: input.quantity,
				});
			} catch (dbError) {
				// Log but don't throw - Stripe update succeeded, webhook will sync DB
				logger.error(
					{ error: dbError, subscriptionId: subscription.id },
					"Failed to update local DB after Stripe seat update, webhook will sync",
				);
			}

			return {
				success: true,
				newQuantity: input.quantity,
			};
		}),

	/**
	 * Get current seat information for the organization
	 */
	getSeatInfo: protectedOrganizationProcedure.query(async ({ ctx }) => {
		if (!billingConfig.enabled || !isStripeConfigured()) {
			return {
				enabled: false,
				seatBased: false,
				currentSeats: 0,
				memberCount: 0,
			};
		}

		const { organization } = ctx;

		// Query member count directly to ensure accuracy
		const members = await db
			.select({ id: memberTable.id })
			.from(memberTable)
			.where(eq(memberTable.organizationId, organization.id));
		const memberCount = members.length;

		// Get current subscription
		const subscription = await getActiveSubscriptionByOrganizationId(
			organization.id,
		);

		if (!subscription) {
			return {
				enabled: true,
				seatBased: false,
				currentSeats: 0,
				memberCount,
			};
		}

		// Check if the plan supports seat-based billing
		const priceConfig = getPriceByStripePriceId(subscription.stripePriceId);
		const isSeatBased =
			priceConfig &&
			"seatBased" in priceConfig.price &&
			priceConfig.price.seatBased;

		return {
			enabled: true,
			seatBased: isSeatBased ?? false,
			currentSeats: subscription.quantity,
			memberCount,
			subscriptionId: subscription.id,
			needsSync: isSeatBased && subscription.quantity !== memberCount,
		};
	}),
});
