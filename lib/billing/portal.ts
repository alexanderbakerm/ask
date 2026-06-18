import "server-only";

import type Stripe from "stripe";
import { getStripe } from "./stripe";
import type { CreatePortalParams } from "./types";

/**
 * Create a Stripe Customer Portal session.
 * The Customer Portal allows customers to manage their subscriptions,
 * update payment methods, and view invoices.
 */
export async function createCustomerPortalSession(
	params: CreatePortalParams,
): Promise<{ url: string }> {
	const { stripeCustomerId, returnUrl } = params;
	const stripe = getStripe();

	const session = await stripe.billingPortal.sessions.create({
		customer: stripeCustomerId,
		return_url: returnUrl,
	});

	return { url: session.url };
}

/**
 * Get the default billing portal configuration.
 * This can be used to check what features are enabled in the portal.
 */
export async function getPortalConfiguration(): Promise<Stripe.BillingPortal.Configuration | null> {
	const stripe = getStripe();

	const configurations = await stripe.billingPortal.configurations.list({
		limit: 1,
		is_default: true,
	});

	return configurations.data[0] ?? null;
}
