import "server-only";

import Stripe from "stripe";
import { appConfig } from "@/config/app.config";
import { env } from "@/lib/env";

// Singleton Stripe client
let stripeClient: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Uses a singleton pattern to avoid creating multiple instances.
 * @throws Error if STRIPE_SECRET_KEY is not set
 */
export function getStripe(): Stripe {
	if (stripeClient) {
		return stripeClient;
	}

	const secretKey = env.STRIPE_SECRET_KEY;

	if (!secretKey) {
		throw new Error(
			"Missing STRIPE_SECRET_KEY environment variable. " +
				"Please add it to your .env file. " +
				"Get your secret key from https://dashboard.stripe.com/apikeys",
		);
	}

	stripeClient = new Stripe(secretKey, {
		typescript: true,
		// Add app info for Stripe Dashboard
		appInfo: {
			name: appConfig.appName,
			version: "1.0.0",
		},
	});

	return stripeClient;
}

/**
 * Check if Stripe is configured (has secret key)
 */
export function isStripeConfigured(): boolean {
	return !!env.STRIPE_SECRET_KEY;
}

/**
 * Get the webhook secret for verifying webhook signatures
 */
export function getWebhookSecret(): string {
	const secret = env.STRIPE_WEBHOOK_SECRET;

	if (!secret) {
		throw new Error(
			"Missing STRIPE_WEBHOOK_SECRET environment variable. " +
				"Please add it to your .env file. " +
				"For local development, use: stripe listen --forward-to localhost:3000/api/webhooks/stripe",
		);
	}

	return secret;
}
