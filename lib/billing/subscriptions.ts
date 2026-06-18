import "server-only";

import type Stripe from "stripe";
import { getStripe } from "./stripe";

/**
 * Get a subscription from Stripe by ID.
 * Returns null if the subscription doesn't exist or was deleted.
 */
export async function getStripeSubscription(
	subscriptionId: string,
): Promise<Stripe.Subscription | null> {
	const stripe = getStripe();
	try {
		return await stripe.subscriptions.retrieve(subscriptionId, {
			expand: ["default_payment_method", "items.data.price"],
		});
	} catch (error) {
		// Handle deleted or non-existent subscriptions gracefully
		const stripeError = error as Stripe.errors.StripeError;
		if (
			stripeError.code === "resource_missing" ||
			stripeError.type === "StripeInvalidRequestError"
		) {
			return null;
		}
		throw error;
	}
}

/**
 * List all subscriptions for a customer
 */
export async function listCustomerSubscriptions(
	customerId: string,
	options?: {
		status?: Stripe.SubscriptionListParams["status"];
		limit?: number;
	},
): Promise<Stripe.Subscription[]> {
	const stripe = getStripe();
	const subscriptions = await stripe.subscriptions.list({
		customer: customerId,
		status: options?.status ?? "all",
		limit: options?.limit ?? 100,
		expand: ["data.default_payment_method", "data.items.data.price"],
	});

	return subscriptions.data;
}

/**
 * Cancel a subscription at the end of the current period
 */
export async function cancelSubscriptionAtPeriodEnd(
	subscriptionId: string,
): Promise<Stripe.Subscription> {
	const stripe = getStripe();
	return stripe.subscriptions.update(subscriptionId, {
		cancel_at_period_end: true,
	});
}

/**
 * Reactivate a subscription that was scheduled for cancellation
 */
export async function reactivateSubscription(
	subscriptionId: string,
): Promise<Stripe.Subscription> {
	const stripe = getStripe();
	return stripe.subscriptions.update(subscriptionId, {
		cancel_at_period_end: false,
	});
}

/**
 * Cancel a subscription immediately
 */
export async function cancelSubscriptionImmediately(
	subscriptionId: string,
): Promise<Stripe.Subscription> {
	const stripe = getStripe();
	return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Update subscription quantity (for seat-based pricing)
 */
export async function updateSubscriptionQuantity(
	subscriptionId: string,
	quantity: number,
): Promise<Stripe.Subscription> {
	const stripe = getStripe();

	// Get the subscription to find the item ID
	const subscription = await stripe.subscriptions.retrieve(subscriptionId);
	const itemId = subscription.items.data[0]?.id;

	if (!itemId) {
		throw new Error("No subscription item found");
	}

	return stripe.subscriptions.update(subscriptionId, {
		items: [
			{
				id: itemId,
				quantity,
			},
		],
		// Prorate the change
		proration_behavior: "create_prorations",
	});
}

/**
 * Change subscription to a different price (upgrade/downgrade)
 */
export async function changeSubscriptionPrice(
	subscriptionId: string,
	newPriceId: string,
	options?: {
		prorationBehavior?: Stripe.SubscriptionUpdateParams["proration_behavior"];
		quantity?: number;
	},
): Promise<Stripe.Subscription> {
	const stripe = getStripe();

	// Get the subscription to find the item ID
	const subscription = await stripe.subscriptions.retrieve(subscriptionId);
	const itemId = subscription.items.data[0]?.id;

	if (!itemId) {
		throw new Error("No subscription item found");
	}

	return stripe.subscriptions.update(subscriptionId, {
		items: [
			{
				id: itemId,
				price: newPriceId,
				quantity: options?.quantity,
			},
		],
		proration_behavior: options?.prorationBehavior ?? "create_prorations",
	});
}

/**
 * Preview upcoming invoice for a subscription change
 * Useful to show users what they'll be charged before making changes
 */
export async function previewSubscriptionChange(params: {
	customerId: string;
	subscriptionId: string;
	newPriceId: string;
	quantity?: number;
}): Promise<Stripe.UpcomingInvoice> {
	const { customerId, subscriptionId, newPriceId, quantity } = params;
	const stripe = getStripe();

	// Get current subscription to find the item ID
	const subscription = await stripe.subscriptions.retrieve(subscriptionId);
	const itemId = subscription.items.data[0]?.id;

	if (!itemId) {
		throw new Error("No subscription item found");
	}

	return stripe.invoices.createPreview({
		customer: customerId,
		subscription: subscriptionId,
		subscription_details: {
			items: [
				{
					id: itemId,
					price: newPriceId,
					quantity,
				},
			],
		},
	});
}

/**
 * Get upcoming invoice for a subscription
 */
export async function getUpcomingInvoice(
	customerId: string,
	subscriptionId?: string,
): Promise<Stripe.UpcomingInvoice | null> {
	const stripe = getStripe();

	try {
		return await stripe.invoices.createPreview({
			customer: customerId,
			subscription: subscriptionId,
		});
	} catch (error) {
		// No upcoming invoice
		if ((error as Stripe.errors.StripeError).code === "invoice_upcoming_none") {
			return null;
		}
		throw error;
	}
}

/**
 * List invoices for a customer
 */
export async function listCustomerInvoices(
	customerId: string,
	options?: {
		limit?: number;
		status?: Stripe.InvoiceListParams["status"];
	},
): Promise<Stripe.Invoice[]> {
	const stripe = getStripe();

	const invoices = await stripe.invoices.list({
		customer: customerId,
		limit: options?.limit ?? 10,
		status: options?.status,
	});

	return invoices.data;
}
