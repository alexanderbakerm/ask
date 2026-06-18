import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import {
	getPlanByStripePriceId,
	getPriceByStripePriceId,
} from "@/lib/billing/plans";
import { db } from "@/lib/db";
import {
	billingEventTable,
	orderItemTable,
	orderTable,
	subscriptionItemTable,
	subscriptionTable,
} from "@/lib/db/schema";
import {
	type BillingInterval,
	OrderStatus,
	PriceModel,
	PriceType,
	SubscriptionStatus,
} from "@/lib/db/schema/enums";
import type { ActivePlanInfo } from "./types";

// ============================================================================
// SUBSCRIPTION QUERIES
// ============================================================================

export type SubscriptionInsert = typeof subscriptionTable.$inferInsert;
export type SubscriptionSelect = typeof subscriptionTable.$inferSelect;

/**
 * Create a new subscription record
 * Uses upsert to handle duplicate webhook events gracefully
 */
export async function createSubscription(
	data: SubscriptionInsert,
): Promise<SubscriptionSelect> {
	const [subscription] = await db
		.insert(subscriptionTable)
		.values(data)
		.onConflictDoUpdate({
			target: subscriptionTable.id,
			set: {
				status: data.status,
				stripePriceId: data.stripePriceId,
				stripeProductId: data.stripeProductId,
				quantity: data.quantity,
				interval: data.interval,
				intervalCount: data.intervalCount,
				unitAmount: data.unitAmount,
				currency: data.currency,
				currentPeriodStart: data.currentPeriodStart,
				currentPeriodEnd: data.currentPeriodEnd,
				trialStart: data.trialStart,
				trialEnd: data.trialEnd,
				cancelAtPeriodEnd: data.cancelAtPeriodEnd,
				canceledAt: data.canceledAt,
			},
		})
		.returning();

	if (!subscription) {
		throw new Error("Failed to create subscription");
	}

	return subscription;
}

/**
 * Update a subscription by ID (Stripe subscription ID)
 */
export async function updateSubscription(
	id: string,
	data: Partial<Omit<SubscriptionInsert, "id">>,
): Promise<SubscriptionSelect | null> {
	const [subscription] = await db
		.update(subscriptionTable)
		.set(data)
		.where(eq(subscriptionTable.id, id))
		.returning();

	return subscription ?? null;
}

/**
 * Delete a subscription by ID
 */
export async function deleteSubscription(id: string): Promise<void> {
	await db.delete(subscriptionTable).where(eq(subscriptionTable.id, id));
}

/**
 * Get a subscription by ID (Stripe subscription ID)
 */
export async function getSubscriptionById(
	id: string,
): Promise<SubscriptionSelect | null> {
	const subscription = await db.query.subscriptionTable.findFirst({
		where: eq(subscriptionTable.id, id),
	});

	return subscription ?? null;
}

/**
 * Get all subscriptions for an organization with optional pagination
 */
export async function getSubscriptionsByOrganizationId(
	organizationId: string,
	options?: { limit?: number; offset?: number },
): Promise<SubscriptionSelect[]> {
	return db.query.subscriptionTable.findMany({
		where: eq(subscriptionTable.organizationId, organizationId),
		orderBy: [desc(subscriptionTable.createdAt)],
		limit: options?.limit,
		offset: options?.offset,
	});
}

/**
 * Get active subscription for an organization
 * An "active" subscription includes: active, trialing, past_due, incomplete
 * - active: Normal active subscription
 * - trialing: In trial period
 * - pastDue: Payment failed but still active (needs attention)
 * - incomplete: Initial payment pending (e.g., 3D Secure confirmation)
 */
export async function getActiveSubscriptionByOrganizationId(
	organizationId: string,
): Promise<SubscriptionSelect | null> {
	const activeStatuses: SubscriptionStatus[] = [
		SubscriptionStatus.active,
		SubscriptionStatus.trialing,
		SubscriptionStatus.pastDue, // Still considered active, but needs attention
		SubscriptionStatus.incomplete, // Payment pending (e.g., 3D Secure)
	];

	const subscription = await db.query.subscriptionTable.findFirst({
		where: and(
			eq(subscriptionTable.organizationId, organizationId),
			inArray(subscriptionTable.status, activeStatuses),
		),
		orderBy: [desc(subscriptionTable.createdAt)],
	});

	return subscription ?? null;
}

/**
 * Get subscription by Stripe customer ID
 */
export async function getSubscriptionByStripeCustomerId(
	stripeCustomerId: string,
): Promise<SubscriptionSelect | null> {
	const subscription = await db.query.subscriptionTable.findFirst({
		where: eq(subscriptionTable.stripeCustomerId, stripeCustomerId),
		orderBy: [desc(subscriptionTable.createdAt)],
	});

	return subscription ?? null;
}

// ============================================================================
// SUBSCRIPTION ITEM QUERIES
// ============================================================================

export type SubscriptionItemInsert = typeof subscriptionItemTable.$inferInsert;
export type SubscriptionItemSelect = typeof subscriptionItemTable.$inferSelect;

/**
 * Create a new subscription item record
 * Uses upsert to handle duplicate webhook events gracefully
 */
export async function createSubscriptionItem(
	data: SubscriptionItemInsert,
): Promise<SubscriptionItemSelect> {
	const [item] = await db
		.insert(subscriptionItemTable)
		.values(data)
		.onConflictDoUpdate({
			target: subscriptionItemTable.id,
			set: {
				stripePriceId: data.stripePriceId,
				stripeProductId: data.stripeProductId,
				quantity: data.quantity,
				priceAmount: data.priceAmount,
				priceType: data.priceType,
				priceModel: data.priceModel,
				interval: data.interval,
				intervalCount: data.intervalCount,
				meterId: data.meterId,
			},
		})
		.returning();

	if (!item) {
		throw new Error("Failed to create subscription item");
	}

	return item;
}

/**
 * Create multiple subscription items in a single transaction
 * Uses batch operations for efficiency
 */
export async function createSubscriptionItems(
	items: SubscriptionItemInsert[],
): Promise<SubscriptionItemSelect[]> {
	if (items.length === 0) return [];

	// Use a transaction with batch upserts for each item
	// Drizzle doesn't support dynamic set values in onConflictDoUpdate for batches,
	// so we use a transaction to keep it atomic while doing individual upserts
	return db.transaction(async (tx) => {
		const results: SubscriptionItemSelect[] = [];

		for (const item of items) {
			const [result] = await tx
				.insert(subscriptionItemTable)
				.values(item)
				.onConflictDoUpdate({
					target: subscriptionItemTable.id,
					set: {
						stripePriceId: item.stripePriceId,
						stripeProductId: item.stripeProductId,
						quantity: item.quantity,
						priceAmount: item.priceAmount,
						priceType: item.priceType,
						priceModel: item.priceModel,
						interval: item.interval,
						intervalCount: item.intervalCount,
						meterId: item.meterId,
					},
				})
				.returning();

			if (result) {
				results.push(result);
			}
		}

		return results;
	});
}

/**
 * Get all subscription items for a subscription
 */
export async function getSubscriptionItemsBySubscriptionId(
	subscriptionId: string,
): Promise<SubscriptionItemSelect[]> {
	return db.query.subscriptionItemTable.findMany({
		where: eq(subscriptionItemTable.subscriptionId, subscriptionId),
	});
}

/**
 * Get a subscription item by ID
 */
export async function getSubscriptionItemById(
	id: string,
): Promise<SubscriptionItemSelect | null> {
	const item = await db.query.subscriptionItemTable.findFirst({
		where: eq(subscriptionItemTable.id, id),
	});

	return item ?? null;
}

/**
 * Update a subscription item
 */
export async function updateSubscriptionItem(
	id: string,
	data: Partial<Omit<SubscriptionItemInsert, "id">>,
): Promise<SubscriptionItemSelect | null> {
	const [item] = await db
		.update(subscriptionItemTable)
		.set(data)
		.where(eq(subscriptionItemTable.id, id))
		.returning();

	return item ?? null;
}

/**
 * Delete a subscription item by ID
 */
export async function deleteSubscriptionItem(id: string): Promise<void> {
	await db
		.delete(subscriptionItemTable)
		.where(eq(subscriptionItemTable.id, id));
}

/**
 * Delete all subscription items for a subscription
 */
export async function deleteSubscriptionItemsBySubscriptionId(
	subscriptionId: string,
): Promise<void> {
	await db
		.delete(subscriptionItemTable)
		.where(eq(subscriptionItemTable.subscriptionId, subscriptionId));
}

/**
 * Sync subscription items from Stripe - delete existing and recreate
 * Uses a transaction to ensure atomicity
 */
export async function syncSubscriptionItems(
	subscriptionId: string,
	items: SubscriptionItemInsert[],
): Promise<SubscriptionItemSelect[]> {
	return db.transaction(async (tx) => {
		// Delete existing items
		await tx
			.delete(subscriptionItemTable)
			.where(eq(subscriptionItemTable.subscriptionId, subscriptionId));

		// Create new items
		if (items.length === 0) return [];

		const results = await tx
			.insert(subscriptionItemTable)
			.values(items)
			.returning();

		return results;
	});
}

/**
 * Convert Stripe subscription items to database format
 * Shared helper for webhook handlers and sync operations
 */
export function stripeItemsToDb(
	subscriptionId: string,
	items: Stripe.SubscriptionItem[],
): SubscriptionItemInsert[] {
	return items.map((item) => {
		const price = item.price;
		const recurring = price.recurring;

		// Determine price model based on our billing config first, then Stripe configuration
		let priceModel: PriceModel = PriceModel.flat;

		// Check our config for seatBased flag (most reliable source of truth)
		const priceConfig = getPriceByStripePriceId(price.id);
		if (
			priceConfig &&
			"seatBased" in priceConfig.price &&
			priceConfig.price.seatBased
		) {
			priceModel = PriceModel.perSeat;
		}
		// Metered billing - check Stripe's usage_type
		else if (recurring?.usage_type === "metered") {
			priceModel = PriceModel.metered;
		}

		return {
			id: item.id,
			subscriptionId,
			stripePriceId: price.id,
			stripeProductId:
				typeof price.product === "string" ? price.product : undefined,
			quantity: item.quantity ?? 1,
			priceAmount: price.unit_amount ?? undefined,
			priceType: recurring ? PriceType.recurring : PriceType.oneTime,
			priceModel,
			interval: recurring?.interval as SubscriptionItemInsert["interval"],
			intervalCount: recurring?.interval_count ?? 1,
			meterId: recurring?.meter ?? undefined,
		};
	});
}

// ============================================================================
// ORDER QUERIES (One-time orders)
// ============================================================================

export type OrderInsert = typeof orderTable.$inferInsert;
export type OrderSelect = typeof orderTable.$inferSelect;

/**
 * Create a new order record
 */
export async function createOrder(data: OrderInsert): Promise<OrderSelect> {
	const [order] = await db.insert(orderTable).values(data).returning();

	if (!order) {
		throw new Error("Failed to create order");
	}

	return order;
}

/**
 * Get an order by ID
 */
export async function getOrderById(id: string): Promise<OrderSelect | null> {
	const order = await db.query.orderTable.findFirst({
		where: eq(orderTable.id, id),
	});

	return order ?? null;
}

/**
 * Get all orders for an organization with optional pagination
 */
export async function getOrdersByOrganizationId(
	organizationId: string,
	options?: { limit?: number; offset?: number },
): Promise<OrderSelect[]> {
	return db.query.orderTable.findMany({
		where: eq(orderTable.organizationId, organizationId),
		orderBy: [desc(orderTable.createdAt)],
		limit: options?.limit,
		offset: options?.offset,
	});
}

/**
 * Get order by checkout session ID
 */
export async function getOrderByCheckoutSessionId(
	checkoutSessionId: string,
): Promise<OrderSelect | null> {
	const order = await db.query.orderTable.findFirst({
		where: eq(orderTable.stripeCheckoutSessionId, checkoutSessionId),
	});

	return order ?? null;
}

/**
 * Get order by payment intent ID
 */
export async function getOrderByPaymentIntentId(
	paymentIntentId: string,
): Promise<OrderSelect | null> {
	const order = await db.query.orderTable.findFirst({
		where: eq(orderTable.stripePaymentIntentId, paymentIntentId),
	});

	return order ?? null;
}

/**
 * Update an order
 */
export async function updateOrder(
	id: string,
	data: Partial<Omit<OrderInsert, "id">>,
): Promise<OrderSelect | null> {
	const [order] = await db
		.update(orderTable)
		.set(data)
		.where(eq(orderTable.id, id))
		.returning();

	return order ?? null;
}

/**
 * Result type for lifetime order query - includes the price ID from the item
 */
export interface LifetimeOrderResult {
	order: OrderSelect;
	stripePriceId: string;
}

/**
 * Get a completed lifetime order for an organization
 * This checks order items to find if any contain a lifetime plan price
 * Returns both the order and the lifetime price ID for plan lookup
 */
export async function getLifetimeOrderByOrganizationId(
	organizationId: string,
): Promise<LifetimeOrderResult | null> {
	// Get all completed orders for the org with their items
	const orders = await db.query.orderTable.findMany({
		where: and(
			eq(orderTable.organizationId, organizationId),
			eq(orderTable.status, OrderStatus.completed),
		),
		with: {
			items: true,
		},
		orderBy: [desc(orderTable.createdAt)],
		limit: 10, // Reasonable limit - most orgs won't have many orders
	});

	// Check each order's items for lifetime plan
	for (const order of orders) {
		for (const item of order.items) {
			const plan = getPlanByStripePriceId(item.stripePriceId);
			if (plan?.id === "lifetime") {
				// Return the order (without items relation) and the price ID
				const { items: _, ...orderWithoutItems } = order;
				return {
					order: orderWithoutItems,
					stripePriceId: item.stripePriceId,
				};
			}
		}
	}

	return null;
}

// ============================================================================
// ORDER ITEM QUERIES
// ============================================================================

export type OrderItemInsert = typeof orderItemTable.$inferInsert;
export type OrderItemSelect = typeof orderItemTable.$inferSelect;

/**
 * Create a new order item record
 */
export async function createOrderItem(
	data: OrderItemInsert,
): Promise<OrderItemSelect> {
	const [item] = await db.insert(orderItemTable).values(data).returning();

	if (!item) {
		throw new Error("Failed to create order item");
	}

	return item;
}

/**
 * Create multiple order items in a single transaction
 */
export async function createOrderItems(
	items: OrderItemInsert[],
): Promise<OrderItemSelect[]> {
	if (items.length === 0) return [];

	const results = await db.insert(orderItemTable).values(items).returning();

	return results;
}

/**
 * Get all order items for an order
 */
export async function getOrderItemsByOrderId(
	orderId: string,
): Promise<OrderItemSelect[]> {
	return db.query.orderItemTable.findMany({
		where: eq(orderItemTable.orderId, orderId),
	});
}

/**
 * Get an order item by ID
 */
export async function getOrderItemById(
	id: string,
): Promise<OrderItemSelect | null> {
	const item = await db.query.orderItemTable.findFirst({
		where: eq(orderItemTable.id, id),
	});

	return item ?? null;
}

/**
 * Delete all order items for an order
 */
export async function deleteOrderItemsByOrderId(
	orderId: string,
): Promise<void> {
	await db.delete(orderItemTable).where(eq(orderItemTable.orderId, orderId));
}

// ============================================================================
// BILLING EVENT QUERIES (Audit log)
// ============================================================================

export type BillingEventInsert = typeof billingEventTable.$inferInsert;
export type BillingEventSelect = typeof billingEventTable.$inferSelect;

/**
 * Create a billing event log entry
 */
export async function createBillingEvent(
	data: BillingEventInsert,
): Promise<BillingEventSelect> {
	const [event] = await db.insert(billingEventTable).values(data).returning();

	if (!event) {
		throw new Error("Failed to create billing event");
	}

	return event;
}

/**
 * Check if a billing event has already been processed (idempotency check)
 */
export async function billingEventExists(
	stripeEventId: string,
): Promise<boolean> {
	const event = await db.query.billingEventTable.findFirst({
		where: eq(billingEventTable.stripeEventId, stripeEventId),
		columns: { id: true },
	});

	return !!event;
}

/**
 * Get billing events for an organization
 */
export async function getBillingEventsByOrganizationId(
	organizationId: string,
	options?: { limit?: number },
): Promise<BillingEventSelect[]> {
	return db.query.billingEventTable.findMany({
		where: eq(billingEventTable.organizationId, organizationId),
		orderBy: [desc(billingEventTable.createdAt)],
		limit: options?.limit ?? 50,
	});
}

/**
 * Mark a billing event as having an error
 */
export async function markBillingEventError(
	id: string,
	error: string,
): Promise<void> {
	await db
		.update(billingEventTable)
		.set({ processed: false, error })
		.where(eq(billingEventTable.id, id));
}

/**
 * Upsert a billing event - update if exists, create if not
 * Uses stripeEventId as the unique key
 */
export async function upsertBillingEvent(
	data: BillingEventInsert,
): Promise<BillingEventSelect> {
	const [event] = await db
		.insert(billingEventTable)
		.values(data)
		.onConflictDoUpdate({
			target: billingEventTable.stripeEventId,
			set: {
				eventType: data.eventType,
				organizationId: data.organizationId,
				subscriptionId: data.subscriptionId,
				orderId: data.orderId,
				eventData: data.eventData,
				processed: data.processed,
				error: data.error,
			},
		})
		.returning();

	if (!event) {
		throw new Error("Failed to upsert billing event");
	}

	return event;
}

/**
 * Check if a subscription exists by ID
 */
export async function subscriptionExists(id: string): Promise<boolean> {
	const subscription = await db.query.subscriptionTable.findFirst({
		where: eq(subscriptionTable.id, id),
		columns: { id: true },
	});
	return !!subscription;
}

// ============================================================================
// ACTIVE PLAN HELPER
// ============================================================================

/**
 * Get the active plan information for an organization
 * This checks both subscriptions and one-time orders (lifetime)
 */
export async function getActivePlanForOrganization(
	organizationId: string,
): Promise<ActivePlanInfo | null> {
	// First, check for active subscription
	const subscription =
		await getActiveSubscriptionByOrganizationId(organizationId);

	if (subscription) {
		const plan = getPlanByStripePriceId(subscription.stripePriceId);

		return {
			planId: plan?.id ?? "unknown",
			planName: plan?.name ?? "Unknown Plan",
			stripePriceId: subscription.stripePriceId,
			status: subscription.status,
			isTrialing: subscription.status === SubscriptionStatus.trialing,
			trialEndsAt: subscription.trialEnd,
			currentPeriodEnd: subscription.currentPeriodEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			quantity: subscription.quantity,
			isLifetime: false,
		};
	}

	// Check for lifetime order - query directly with filter instead of fetching all
	const lifetimeResult = await getLifetimeOrderByOrganizationId(organizationId);

	if (lifetimeResult) {
		const plan = getPlanByStripePriceId(lifetimeResult.stripePriceId);

		return {
			planId: plan?.id ?? "lifetime",
			planName: plan?.name ?? "Lifetime",
			stripePriceId: lifetimeResult.stripePriceId,
			status: "active",
			isTrialing: false,
			trialEndsAt: null,
			currentPeriodEnd: null, // Lifetime has no end
			cancelAtPeriodEnd: false,
			quantity: 1,
			isLifetime: true,
		};
	}

	// No active plan - return null (user is on free tier)
	return null;
}

/**
 * Check if an organization has an active paid plan
 */
export async function hasActivePaidPlan(
	organizationId: string,
): Promise<boolean> {
	const activePlan = await getActivePlanForOrganization(organizationId);
	return activePlan !== null;
}

/**
 * Check if an organization has a specific plan
 */
export async function hasSpecificPlan(
	organizationId: string,
	planId: string,
): Promise<boolean> {
	const activePlan = await getActivePlanForOrganization(organizationId);
	return activePlan?.planId === planId;
}

// ============================================================================
// STRIPE SYNC HELPERS
// ============================================================================

/**
 * Convert a Stripe Unix timestamp to a Date object safely
 */
export function safeTsToDate(ts: number | null | undefined): Date | null {
	if (ts === null || ts === undefined || ts === 0) return null;
	const date = new Date(ts * 1000);
	// Check if date is valid
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

/**
 * Convert Stripe subscription to database format
 */
export function stripeSubscriptionToDb(
	stripeSubscription: any, // Use any to allow for different Stripe API versions and webhook vs retrieve data
	organizationId: string,
): SubscriptionInsert {
	const item = stripeSubscription.items?.data?.[0];
	const price = item?.price;

	// Ensure quantity is at least 1
	// Favor item quantity as top-level quantity is deprecated in newer Stripe APIs
	const quantity = Math.max(
		1,
		item?.quantity ?? stripeSubscription.quantity ?? 1,
	);

	// Stripe API 2025-12-15+ moved current_period_* to subscription items
	// Fall back to item-level dates, start_date, billing_cycle_anchor, or current time
	const currentPeriodStartTs =
		stripeSubscription.current_period_start ??
		item?.current_period_start ??
		stripeSubscription.start_date ??
		stripeSubscription.created ??
		Math.floor(Date.now() / 1000);

	const currentPeriodEndTs =
		stripeSubscription.current_period_end ??
		item?.current_period_end ??
		stripeSubscription.billing_cycle_anchor ??
		Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // Default to 30 days

	return {
		id: stripeSubscription.id,
		organizationId,
		stripeCustomerId:
			typeof stripeSubscription.customer === "string"
				? stripeSubscription.customer
				: stripeSubscription.customer?.id,
		status: (stripeSubscription.status ?? "active") as SubscriptionStatus,
		stripePriceId: price?.id ?? "",
		stripeProductId:
			typeof price?.product === "string" ? price.product : undefined,
		quantity,
		interval: (price?.recurring?.interval ?? "month") as BillingInterval,
		intervalCount: price?.recurring?.interval_count ?? 1,
		unitAmount: price?.unit_amount ?? null,
		currency: stripeSubscription.currency ?? "usd",
		// Use safeTsToDate with a fallback for required non-null fields
		currentPeriodStart: safeTsToDate(currentPeriodStartTs) ?? new Date(),
		currentPeriodEnd: safeTsToDate(currentPeriodEndTs) ?? new Date(),
		trialStart: safeTsToDate(stripeSubscription.trial_start),
		trialEnd: safeTsToDate(stripeSubscription.trial_end),
		cancelAtPeriodEnd: !!stripeSubscription.cancel_at_period_end,
		canceledAt: safeTsToDate(stripeSubscription.canceled_at),
	};
}
