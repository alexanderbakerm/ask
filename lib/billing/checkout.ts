import "server-only";

import type Stripe from "stripe";
import { creditPackages } from "@/config/billing.config";
import { getPriceByStripePriceId } from "@/lib/billing/plans";
import { getOrCreateStripeCustomer } from "./customer";
import { getStripe } from "./stripe";
import type { CreateCheckoutParams } from "./types";

/**
 * Create a Stripe Checkout session for a subscription or one-time order.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckoutSession(
	params: CreateCheckoutParams,
): Promise<{ url: string; sessionId: string }> {
	const {
		organizationId,
		stripePriceId,
		successUrl,
		cancelUrl,
		stripeCustomerId,
		email,
		quantity = 1,
		trialDays,
		metadata = {},
	} = params;

	const stripe = getStripe();

	// Look up the price configuration
	let priceConfig = getPriceByStripePriceId(stripePriceId);

	if (!priceConfig) {
		// Check if it's a credit package
		const creditPackage = creditPackages.find(
			(p) => p.stripePriceId === stripePriceId,
		);

		if (creditPackage) {
			priceConfig = {
				plan: {
					id: creditPackage.id,
					name: creditPackage.name,
					description: creditPackage.description,
					features: [],
				} as any,
				price: {
					id: creditPackage.id,
					stripePriceId: creditPackage.stripePriceId,
					amount: creditPackage.priceAmount,
					currency: creditPackage.currency,
					type: "one_time",
				},
			};
		}
	}

	if (!priceConfig) {
		throw new Error(`Price configuration not found for ${stripePriceId}`);
	}

	const { price, plan } = priceConfig;
	const isSubscription = price.type === "recurring";

	// Build line items
	const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
		{
			price: stripePriceId,
			quantity,
		},
	];

	// Determine mode based on price type
	const mode: Stripe.Checkout.SessionCreateParams.Mode = isSubscription
		? "subscription"
		: "payment";

	// Build session params
	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		mode,
		line_items: lineItems,
		success_url: successUrl,
		cancel_url: cancelUrl,
		metadata: {
			organizationId,
			planId: plan.id,
			priceId: price.id,
			...metadata,
		},
		// Allow promo codes
		allow_promotion_codes: true,
		// Collect billing address for tax
		billing_address_collection: "auto",
		// Enable automatic tax calculation if configured
		// automatic_tax: { enabled: true },
	};

	// Handle existing customer or create new one
	if (stripeCustomerId) {
		sessionParams.customer = stripeCustomerId;
	} else if (email) {
		sessionParams.customer_email = email;
	}

	// Add subscription-specific settings
	if (isSubscription) {
		// Get trial days from price config or params
		const effectiveTrialDays =
			trialDays ?? ("trialDays" in price ? price.trialDays : undefined);

		if (effectiveTrialDays && effectiveTrialDays > 0) {
			sessionParams.subscription_data = {
				trial_period_days: effectiveTrialDays,
				metadata: {
					organizationId,
					planId: plan.id,
				},
			};
		} else {
			sessionParams.subscription_data = {
				metadata: {
					organizationId,
					planId: plan.id,
				},
			};
		}
	} else {
		// One-time payment settings
		sessionParams.payment_intent_data = {
			metadata: {
				organizationId,
				planId: plan.id,
			},
		};
	}

	// Generate idempotency key to prevent duplicate checkout sessions on retry
	// Uses organizationId + priceId + timestamp (rounded to minute) for uniqueness
	const IDEMPOTENCY_WINDOW_MS = 60 * 1000; // 1 minute
	const idempotencyTimestamp = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);
	const idempotencyKey = `checkout-${organizationId}-${stripePriceId}-${idempotencyTimestamp}`;

	const session = await stripe.checkout.sessions.create(sessionParams, {
		idempotencyKey,
	});

	if (!session.url) {
		throw new Error("Failed to create checkout session: no URL returned");
	}

	return {
		url: session.url,
		sessionId: session.id,
	};
}

/**
 * Create a checkout session with automatic customer creation.
 * This is a convenience wrapper that handles customer lookup/creation.
 */
export async function createCheckoutWithCustomer(params: {
	organizationId: string;
	organizationName: string;
	stripePriceId: string;
	successUrl: string;
	cancelUrl: string;
	email?: string;
	quantity?: number;
	trialDays?: number;
	metadata?: Record<string, string>;
}): Promise<{ url: string; sessionId: string }> {
	const {
		organizationId,
		organizationName,
		stripePriceId,
		successUrl,
		cancelUrl,
		email,
		quantity,
		trialDays,
		metadata,
	} = params;

	// Get or create the Stripe customer
	const customer = await getOrCreateStripeCustomer({
		organizationId,
		organizationName,
		email,
	});

	return createCheckoutSession({
		organizationId,
		stripePriceId,
		successUrl,
		cancelUrl,
		stripeCustomerId: customer.id,
		quantity,
		trialDays,
		metadata,
	});
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(
	sessionId: string,
): Promise<Stripe.Checkout.Session> {
	const stripe = getStripe();
	return stripe.checkout.sessions.retrieve(sessionId, {
		expand: ["subscription", "payment_intent", "customer"],
	});
}
