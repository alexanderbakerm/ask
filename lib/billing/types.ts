import type {
	BillingInterval,
	OrderStatus,
	SubscriptionStatus,
} from "@/lib/db/schema/enums";

/**
 * Subscription data stored in our database
 */
export interface Subscription {
	id: string; // Stripe subscription ID
	organizationId: string;
	stripeCustomerId: string;
	status: SubscriptionStatus;
	stripePriceId: string;
	stripeProductId: string | null;
	quantity: number;
	interval: BillingInterval;
	intervalCount: number;
	unitAmount: number | null;
	currency: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	trialStart: Date | null;
	trialEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	canceledAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * One-time order data stored in our database (header)
 */
export interface Order {
	id: string;
	organizationId: string;
	stripeCustomerId: string;
	stripePaymentIntentId: string | null;
	stripeCheckoutSessionId: string | null;
	totalAmount: number;
	currency: string;
	status: OrderStatus;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Order item - individual line item within an order
 */
export interface OrderItem {
	id: string;
	orderId: string;
	stripePriceId: string;
	stripeProductId: string | null;
	quantity: number;
	unitAmount: number;
	totalAmount: number;
	description: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Billing event log entry
 */
export interface BillingEvent {
	id: string;
	organizationId: string | null;
	stripeEventId: string;
	eventType: string;
	subscriptionId: string | null;
	orderId: string | null;
	eventData: string | null;
	processed: boolean;
	error: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Parameters for creating a checkout session
 */
export interface CreateCheckoutParams {
	organizationId: string;
	stripePriceId: string;
	successUrl: string;
	cancelUrl: string;
	// Optional: existing customer ID
	stripeCustomerId?: string;
	// Optional: user email for new customers
	email?: string;
	// Optional: quantity (for per-seat pricing)
	quantity?: number;
	// Optional: trial period in days
	trialDays?: number;
	// Optional: metadata
	metadata?: Record<string, string>;
}

/**
 * Parameters for creating a customer portal session
 */
export interface CreatePortalParams {
	stripeCustomerId: string;
	returnUrl: string;
}

/**
 * Result of checking active plan
 */
export interface ActivePlanInfo {
	planId: string;
	planName: string;
	stripePriceId: string;
	status: SubscriptionStatus | "active"; // "active" for lifetime
	isTrialing: boolean;
	trialEndsAt: Date | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	quantity: number;
	// For one-time orders
	isLifetime: boolean;
}

/**
 * Webhook event types we handle
 */
export type WebhookEventType =
	| "checkout.session.completed"
	| "customer.subscription.created"
	| "customer.subscription.updated"
	| "customer.subscription.deleted"
	| "customer.subscription.paused"
	| "customer.subscription.resumed"
	| "customer.subscription.trial_will_end"
	| "invoice.paid"
	| "invoice.payment_failed"
	| "charge.refunded"
	| "customer.created"
	| "customer.updated"
	| "customer.deleted";

/**
 * Webhook handler result
 */
export interface WebhookResult {
	success: boolean;
	message: string;
	eventId?: string;
}

/**
 * UI Types - Used by pricing components
 */

/**
 * Price information for display in UI components
 */
export interface PriceDisplay {
	id: string;
	stripePriceId: string;
	type: "recurring" | "one_time";
	amount: number;
	currency: string;
	interval?: "month" | "year" | "week" | "day" | null;
	intervalCount?: number | null;
	trialDays?: number | null;
}

/**
 * Plan information for display in pricing tables
 */
export interface PlanDisplay {
	id: string;
	name: string;
	description: string;
	features: string[];
	prices: PriceDisplay[]; // Required - use empty array for free/enterprise plans
	isFree?: boolean;
	isEnterprise?: boolean;
	recommended?: boolean;
}
