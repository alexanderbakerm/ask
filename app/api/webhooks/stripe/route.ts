import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { creditPackages } from "@/config/billing.config";
import {
	billingEventExists,
	createBillingEvent,
	createOrder,
	createOrderItems,
	createSubscription,
	getOrderByPaymentIntentId,
	getOrganizationByStripeCustomerId,
	getStripe,
	getSubscriptionById,
	getWebhookSecret,
	markBillingEventError,
	safeTsToDate,
	stripeItemsToDb,
	stripeSubscriptionToDb,
	subscriptionExists,
	syncSubscriptionItems,
	updateOrder,
	updateSubscription,
	upsertBillingEvent,
} from "@/lib/billing";
import { addCredits, reverseCredits } from "@/lib/billing/credits";
import {
	sendDisputeNotification,
	sendPaymentFailedNotification,
	sendSubscriptionCanceledNotification,
	sendTrialEndingSoonNotification,
} from "@/lib/billing/notifications";
import { getPlanByStripePriceId } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { creditTransactionTable, organizationTable } from "@/lib/db/schema";
import {
	CreditTransactionType,
	OrderStatus,
	SubscriptionStatus,
} from "@/lib/db/schema/enums";
import { LoggerFactory } from "@/lib/logger/factory";

const logger = LoggerFactory.getLogger("stripe-webhook");

/**
 * Determine if an error is transient and should be retried by Stripe
 */
function isTransientError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const message = error.message.toLowerCase();
	const transientPatterns = [
		"timeout",
		"etimedout",
		"econnrefused",
		"econnreset",
		"epipe",
		"enetunreach",
		"ehostunreach",
		"connection",
		"network",
		"socket hang up",
		"aborted",
		"too many connections",
		"pool timeout",
	];

	return transientPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Fetch fresh subscription data from Stripe to avoid processing stale webhook data.
 * Skips re-fetch if subscription is in a final state (canceled, incomplete_expired).
 */
async function fetchFreshSubscription(
	subscription: Stripe.Subscription,
): Promise<Stripe.Subscription> {
	// Skip re-fetch for final states - data won't change
	if (
		subscription.status === "canceled" ||
		subscription.status === "incomplete_expired"
	) {
		return subscription;
	}

	try {
		const stripe = getStripe();
		const freshSubscription = await stripe.subscriptions.retrieve(
			subscription.id,
		);
		logger.info("Fetched fresh subscription data from Stripe", {
			subscriptionId: subscription.id,
			webhookStatus: subscription.status,
			freshStatus: freshSubscription.status,
		});
		return freshSubscription;
	} catch (err) {
		// Fall back to webhook data if fetch fails
		logger.warn("Failed to fetch fresh subscription, using webhook data", {
			subscriptionId: subscription.id,
			error: err instanceof Error ? err.message : "Unknown error",
		});
		return subscription;
	}
}

/**
 * Stripe webhook handler
 * Handles billing events from Stripe and updates the database
 *
 * Events handled:
 * - checkout.session.completed: One-time order or subscription started
 * - customer.subscription.created: New subscription created
 * - customer.subscription.updated: Subscription updated (status, plan, etc.)
 * - customer.subscription.deleted: Subscription cancelled/deleted
 * - invoice.paid: Invoice successfully paid
 * - invoice.payment_failed: Payment failed
 */
export async function POST(request: Request) {
	const body = await request.text();
	const headersList = await headers();
	const signature = headersList.get("stripe-signature");

	if (!signature) {
		logger.error("Missing stripe-signature header");
		return NextResponse.json(
			{ error: "Missing stripe-signature header" },
			{ status: 400 },
		);
	}

	let event: Stripe.Event;

	try {
		const stripe = getStripe();
		const webhookSecret = getWebhookSecret();
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		logger.error("Webhook signature verification failed", { error: message });
		return NextResponse.json(
			{ error: `Webhook signature verification failed: ${message}` },
			{ status: 400 },
		);
	}

	// Idempotency check - skip if we've already processed this event
	const alreadyProcessed = await billingEventExists(event.id);
	if (alreadyProcessed) {
		logger.info("Event already processed", { eventId: event.id });
		return NextResponse.json({ received: true, status: "already_processed" });
	}

	// Create billing event record FIRST to prevent race conditions
	// This acts as a lock - if another request tries to process the same event,
	// the billingEventExists check above will catch it
	let billingEventId: string | null = null;
	try {
		const billingEvent = await createBillingEvent({
			stripeEventId: event.id,
			eventType: event.type,
			organizationId: null, // Will be updated during processing
			subscriptionId: null,
			orderId: null,
			eventData: JSON.stringify({ status: "processing" }),
			processed: false,
		});
		billingEventId = billingEvent.id;
	} catch (err) {
		// If we can't create the event record (e.g., duplicate key), another process is handling it
		logger.info("Event already being processed by another request", {
			eventId: event.id,
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json({ received: true, status: "already_processing" });
	}

	// Process the event
	try {
		await handleStripeEvent(event);

		// Mark event as successfully processed
		// This is a safety net - individual handlers also call logBillingEvent()
		// but this ensures processed=true even if handler exits early or
		// the logBillingEvent call at the end of handler fails
		if (billingEventId) {
			try {
				await upsertBillingEvent({
					stripeEventId: event.id,
					eventType: event.type,
					organizationId: null, // Already set by handler's logBillingEvent if available
					subscriptionId: null,
					orderId: null,
					eventData: JSON.stringify({ status: "completed" }),
					processed: true,
					error: null,
				});
			} catch (updateErr) {
				// Log but don't fail - the event was processed successfully
				logger.warn("Failed to mark event as processed", {
					eventId: event.id,
					error:
						updateErr instanceof Error ? updateErr.message : "Unknown error",
				});
			}
		}

		return NextResponse.json({ received: true, status: "processed" });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		logger.error("Error processing webhook event", {
			eventId: event.id,
			eventType: event.type,
			error: message,
		});

		// Mark the event as failed
		if (billingEventId) {
			await markBillingEventError(billingEventId, message);
		}

		// Return 500 for transient errors so Stripe will retry
		// Only return 200 for permanent failures (e.g., invalid data)
		if (isTransientError(err)) {
			return NextResponse.json(
				{ received: false, status: "error", error: message },
				{ status: 500 },
			);
		}

		// Return 200 for permanent failures to prevent endless retries
		return NextResponse.json({
			received: true,
			status: "error",
			error: message,
		});
	}
}

/**
 * Main event handler - routes to specific handlers based on event type
 */
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
	const eventType = event.type;

	logger.info("Processing webhook event", {
		eventId: event.id,
		eventType,
	});

	switch (eventType) {
		case "checkout.session.completed":
			await handleCheckoutSessionCompleted(
				event.id,
				event.data.object as Stripe.Checkout.Session,
			);
			break;

		case "customer.subscription.created":
			await handleSubscriptionCreated(
				event.id,
				event.data.object as Stripe.Subscription,
			);
			break;

		case "customer.subscription.updated":
			await handleSubscriptionUpdated(
				event.id,
				event.data.object as Stripe.Subscription,
			);
			break;

		case "customer.subscription.deleted":
			await handleSubscriptionDeleted(
				event.id,
				event.data.object as Stripe.Subscription,
			);
			break;

		case "invoice.paid":
			await handleInvoicePaid(event.id, event.data.object as Stripe.Invoice);
			break;

		case "invoice.payment_failed":
			await handleInvoicePaymentFailed(
				event.id,
				event.data.object as Stripe.Invoice,
			);
			break;

		case "customer.subscription.trial_will_end":
			await handleTrialWillEnd(
				event.id,
				event.data.object as Stripe.Subscription,
			);
			break;

		case "charge.refunded":
			await handleChargeRefunded(event.id, event.data.object as Stripe.Charge);
			break;

		case "customer.subscription.paused":
			await handleSubscriptionPaused(
				event.id,
				event.data.object as Stripe.Subscription,
			);
			break;

		case "customer.subscription.resumed":
			await handleSubscriptionResumed(
				event.id,
				event.data.object as Stripe.Subscription,
			);
			break;

		case "customer.deleted":
			await handleCustomerDeleted(
				event.id,
				event.data.object as Stripe.Customer | Stripe.DeletedCustomer,
			);
			break;

		case "payment_intent.succeeded":
			await handlePaymentIntentSucceeded(
				event.id,
				event.data.object as Stripe.PaymentIntent,
			);
			break;

		// Refund lifecycle events - more reliable than charge.refunded
		case "refund.created":
		case "refund.updated":
		case "refund.failed":
			await handleRefundEvent(
				event.id,
				event.type,
				event.data.object as Stripe.Refund,
			);
			break;

		// Dispute/chargeback events - critical for payment protection
		case "charge.dispute.created":
		case "charge.dispute.updated":
		case "charge.dispute.closed":
		case "charge.dispute.funds_withdrawn":
		case "charge.dispute.funds_reinstated":
			await handleDisputeEvent(
				event.id,
				event.type,
				event.data.object as Stripe.Dispute,
			);
			break;

		default:
			// Log unhandled events but don't fail
			logger.info("Unhandled event type", { eventType });
			await logBillingEvent(event.id, eventType, null, {
				eventType,
				objectId: (event.data.object as { id?: string }).id,
			});
	}
}

/**
 * Handle checkout.session.completed
 * This is triggered when a checkout session is completed (either subscription or one-time)
 */
async function handleCheckoutSessionCompleted(
	eventId: string,
	session: Stripe.Checkout.Session,
): Promise<void> {
	const customerId =
		typeof session.customer === "string"
			? session.customer
			: session.customer?.id;

	if (!customerId) {
		logger.error("No customer ID in checkout session", {
			sessionId: session.id,
		});
		return;
	}

	// Get organization from customer
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (session.metadata?.organizationId as string);

	if (!organizationId) {
		logger.error("Could not determine organization for checkout", {
			sessionId: session.id,
			customerId,
		});
		return;
	}

	// Check if this is a credit purchase
	if (session.metadata?.type === "credit_purchase") {
		await handleCreditPurchase(eventId, session, organizationId);
		return;
	}

	// Handle one-time payment (not subscription)
	if (session.mode === "payment") {
		// Line items may not be expanded in webhook payload, fetch them if needed
		let lineItems = session.line_items?.data;
		if (!lineItems || lineItems.length === 0) {
			try {
				const stripe = getStripe();
				const expandedSession = await stripe.checkout.sessions.retrieve(
					session.id,
					{ expand: ["line_items"] },
				);
				lineItems = expandedSession.line_items?.data;
			} catch (err) {
				logger.error("Failed to fetch line items for checkout session", {
					sessionId: session.id,
					error: err instanceof Error ? err.message : "Unknown error",
				});
			}
		}

		if (lineItems && lineItems.length > 0) {
			// Create the order (header)
			const order = await createOrder({
				organizationId,
				stripeCustomerId: customerId,
				stripePaymentIntentId:
					typeof session.payment_intent === "string"
						? session.payment_intent
						: (session.payment_intent?.id ?? null),
				stripeCheckoutSessionId: session.id,
				totalAmount: session.amount_total ?? 0,
				currency: session.currency ?? "usd",
				status: OrderStatus.completed,
			});

			// Create order items from line items
			const orderItems = lineItems.map((lineItem) => ({
				orderId: order.id,
				stripePriceId: lineItem.price?.id ?? "",
				stripeProductId:
					typeof lineItem.price?.product === "string"
						? lineItem.price.product
						: null,
				quantity: lineItem.quantity ?? 1,
				unitAmount: lineItem.price?.unit_amount ?? 0,
				totalAmount: lineItem.amount_total ?? 0,
				description: lineItem.description ?? null,
			}));

			await createOrderItems(orderItems);

			logger.info("One-time order created with items", {
				organizationId,
				sessionId: session.id,
				orderId: order.id,
				itemCount: orderItems.length,
			});
		} else {
			logger.warn("No line items found for one-time payment checkout", {
				sessionId: session.id,
				organizationId,
			});
		}
	}

	// Log the event
	await logBillingEvent(eventId, "checkout.session.completed", organizationId, {
		sessionId: session.id,
		mode: session.mode,
		customerId,
	});
}

/**
 * Check if an error is a unique constraint violation
 */
function isUniqueConstraintViolation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	// PostgreSQL unique violation error code is 23505
	const message = error.message.toLowerCase();
	return (
		message.includes("unique") ||
		message.includes("duplicate") ||
		message.includes("23505")
	);
}

/**
 * Handle credit package purchase
 * Called when a checkout session with type="credit_purchase" completes
 *
 * Uses database unique constraint for idempotency instead of pre-check
 * to avoid TOCTOU race conditions
 */
async function handleCreditPurchase(
	eventId: string,
	session: Stripe.Checkout.Session,
	organizationId: string,
): Promise<void> {
	const packageId = session.metadata?.packageId;
	const userId = session.metadata?.userId;

	logger.info(
		{ eventId, sessionId: session.id, organizationId, packageId },
		"Processing credit purchase",
	);

	if (!packageId) {
		logger.error(
			{ sessionId: session.id },
			"Missing packageId in credit purchase metadata",
		);
		return;
	}

	// Get package details from config
	const pkg = creditPackages.find((p) => p.id === packageId);
	if (!pkg) {
		logger.error({ packageId }, "Unknown credit package");
		return;
	}

	const baseCredits = pkg.credits;
	const bonusCredits = pkg.bonusCredits;

	// Add base credits - uses unique constraint for idempotency
	// If this is a retry of an already-processed session, the unique constraint
	// on (reference_type, reference_id) WHERE reference_type = 'checkout_session'
	// will prevent duplicate insertion
	try {
		await addCredits({
			organizationId,
			amount: baseCredits,
			type: CreditTransactionType.purchase,
			description: `Purchased ${pkg.name} credit package`,
			referenceType: "checkout_session",
			referenceId: session.id,
			createdBy: userId ?? undefined,
			metadata: {
				packageId,
				amountPaid: session.amount_total,
				stripeSessionId: session.id,
			},
		});
	} catch (error) {
		if (isUniqueConstraintViolation(error)) {
			logger.info(
				{ sessionId: session.id, organizationId },
				"Credit purchase already processed (caught by unique constraint), skipping",
			);
			return;
		}
		throw error;
	}

	// Add bonus credits separately (for clearer tracking)
	// Use a different reference format to allow both base and bonus for same session
	if (bonusCredits > 0) {
		try {
			await addCredits({
				organizationId,
				amount: bonusCredits,
				type: CreditTransactionType.bonus,
				description: `Bonus credits from ${pkg.name} package`,
				referenceType: "checkout_session_bonus",
				referenceId: session.id,
				createdBy: userId ?? undefined,
				metadata: {
					packageId,
					baseCredits,
				},
			});
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				logger.info(
					{ sessionId: session.id, organizationId },
					"Bonus credits already added, skipping",
				);
			} else {
				throw error;
			}
		}
	}

	logger.info(
		{
			organizationId,
			packageId,
			baseCredits,
			bonusCredits,
			totalCredits: baseCredits + bonusCredits,
		},
		"Credits added from purchase",
	);

	// Log billing event
	await logBillingEvent(eventId, "credit_purchase", organizationId, {
		packageId,
		baseCredits,
		bonusCredits,
		amountPaid: session.amount_total,
		sessionId: session.id,
	});
}

/**
 * Handle customer.subscription.created
 * This is triggered when a new subscription is created
 */
async function handleSubscriptionCreated(
	eventId: string,
	webhookSubscription: Stripe.Subscription,
): Promise<void> {
	// Fetch fresh subscription data to avoid stale webhook data
	const subscription = await fetchFreshSubscription(webhookSubscription);

	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	// Get organization from customer or metadata
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (subscription.metadata?.organizationId as string);

	if (!organizationId) {
		logger.error("Could not determine organization for subscription", {
			subscriptionId: subscription.id,
			customerId,
		});
		return;
	}

	// Get item details
	const item = subscription.items.data[0];
	const price = item?.price;

	// Create subscription record using robust helper
	const subscriptionData = stripeSubscriptionToDb(subscription, organizationId);
	await createSubscription(subscriptionData);

	// Sync subscription items for granular line item tracking
	const itemsData = stripeItemsToDb(subscription.id, subscription.items.data);
	await syncSubscriptionItems(subscription.id, itemsData);

	logger.info("Subscription created", {
		subscriptionId: subscription.id,
		organizationId,
		status: subscription.status,
		itemCount: itemsData.length,
	});

	// Log the event
	await logBillingEvent(
		eventId,
		"customer.subscription.created",
		organizationId,
		{
			subscriptionId: subscription.id,
			status: subscription.status,
			priceId: price?.id,
			itemCount: itemsData.length,
		},
		subscription.id,
	);
}

/**
 * Handle customer.subscription.updated
 * This is triggered when a subscription is updated (plan change, status change, etc.)
 */
async function handleSubscriptionUpdated(
	eventId: string,
	webhookSubscription: Stripe.Subscription,
): Promise<void> {
	// Fetch fresh subscription data to avoid stale webhook data
	const subscription = await fetchFreshSubscription(webhookSubscription);

	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	// Get organization from customer
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (subscription.metadata?.organizationId as string);

	if (!organizationId) {
		logger.error("Could not determine organization for subscription update", {
			subscriptionId: subscription.id,
			customerId,
		});
		return;
	}

	const item = subscription.items.data[0];
	const price = item?.price;

	// Check if subscription exists - if not, create it (handles out-of-order events)
	const existingSubscription = await getSubscriptionById(subscription.id);

	if (!existingSubscription) {
		// Create subscription if it doesn't exist
		logger.info("Subscription not found, creating from update event", {
			subscriptionId: subscription.id,
			organizationId,
		});

		const subscriptionData = stripeSubscriptionToDb(
			subscription,
			organizationId,
		);

		await createSubscription(subscriptionData);
	} else {
		// Update existing subscription record using the robust mapping helper
		const subUpdate = stripeSubscriptionToDb(subscription, organizationId);
		// Remove fields we don't want to update via mapping if any (but usually it's fine)
		const { id: _, organizationId: __, ...updateFields } = subUpdate;

		await updateSubscription(subscription.id, updateFields);
	}

	// Sync subscription items (handles both create and update cases)
	const itemsData = stripeItemsToDb(subscription.id, subscription.items.data);
	await syncSubscriptionItems(subscription.id, itemsData);

	logger.info("Subscription updated", {
		subscriptionId: subscription.id,
		organizationId,
		status: subscription.status,
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		itemCount: itemsData.length,
	});

	// Log the event
	await logBillingEvent(
		eventId,
		"customer.subscription.updated",
		organizationId,
		{
			subscriptionId: subscription.id,
			status: subscription.status,
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			priceId: price?.id,
			itemCount: itemsData.length,
		},
		subscription.id,
	);
}

/**
 * Handle customer.subscription.deleted
 * This is triggered when a subscription is cancelled/deleted
 */
async function handleSubscriptionDeleted(
	eventId: string,
	webhookSubscription: Stripe.Subscription,
): Promise<void> {
	// Fetch fresh subscription data to avoid stale webhook data
	const subscription = await fetchFreshSubscription(webhookSubscription);

	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	// Get organization from customer
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (subscription.metadata?.organizationId as string);

	// Check if subscription exists before updating
	const exists = await subscriptionExists(subscription.id);
	if (exists) {
		// Update subscription status to canceled instead of deleting
		// This preserves the history
		await updateSubscription(subscription.id, {
			status: SubscriptionStatus.canceled,
			canceledAt: new Date(),
		});
	} else {
		logger.warn("Subscription not found for deletion event", {
			subscriptionId: subscription.id,
			organizationId,
		});
	}

	logger.info("Subscription deleted/canceled", {
		subscriptionId: subscription.id,
		organizationId,
	});

	// Log the event
	await logBillingEvent(
		eventId,
		"customer.subscription.deleted",
		organizationId ?? null,
		{
			subscriptionId: subscription.id,
		},
		subscription.id,
	);

	// Send cancellation notification to admins (only if we have organization and subscription existed)
	if (organizationId && exists) {
		const priceId = subscription.items.data[0]?.price?.id;
		const plan = priceId ? getPlanByStripePriceId(priceId) : null;
		// Use robust mapping to get current period end safely
		const subData = stripeSubscriptionToDb(subscription, organizationId);
		await sendSubscriptionCanceledNotification({
			organizationId,
			planName: plan?.name ?? "Unknown Plan",
			cancelDate: new Date(),
			accessEndDate: subData.currentPeriodEnd,
		});
	}
}

/**
 * Handle customer.subscription.trial_will_end
 * This is triggered 3 days before a trial ends
 */
async function handleTrialWillEnd(
	eventId: string,
	webhookSubscription: Stripe.Subscription,
): Promise<void> {
	// Fetch fresh subscription data to avoid stale webhook data
	const subscription = await fetchFreshSubscription(webhookSubscription);

	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	// Get organization from customer
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (subscription.metadata?.organizationId as string);

	if (!organizationId) {
		logger.error("Could not determine organization for trial ending notice", {
			subscriptionId: subscription.id,
			customerId,
		});
		return;
	}

	const priceId = subscription.items.data[0]?.price?.id;
	const plan = priceId ? getPlanByStripePriceId(priceId) : null;

	// Calculate days remaining
	const trialEnd = subscription.trial_end;
	const daysRemaining = trialEnd
		? Math.ceil((trialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
		: 3;

	logger.info("Trial ending soon", {
		subscriptionId: subscription.id,
		organizationId,
		daysRemaining,
	});

	// Log the event
	await logBillingEvent(
		eventId,
		"customer.subscription.trial_will_end",
		organizationId,
		{
			subscriptionId: subscription.id,
			trialEnd,
			daysRemaining,
			priceId,
		},
		subscription.id,
	);

	// Send trial ending notification to admins
	await sendTrialEndingSoonNotification({
		organizationId,
		planName: plan?.name ?? "Pro",
		trialEndDate: safeTsToDate(trialEnd) ?? new Date(),
		daysRemaining: Math.max(0, daysRemaining),
	});
}

/**
 * Handle invoice.paid
 * This is triggered when an invoice is successfully paid
 */
async function handleInvoicePaid(
	eventId: string,
	invoice: Stripe.Invoice,
): Promise<void> {
	const customerId =
		typeof invoice.customer === "string"
			? invoice.customer
			: invoice.customer?.id;

	if (!customerId) {
		logger.error("No customer ID in invoice", { invoiceId: invoice.id });
		return;
	}

	// Get organization from customer
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId = organization?.id ?? null;

	// Get subscription ID from invoice
	const subscriptionId =
		typeof invoice.parent?.subscription_details?.subscription === "string"
			? invoice.parent.subscription_details.subscription
			: (invoice.parent?.subscription_details?.subscription ?? null);

	logger.info("Invoice paid", {
		invoiceId: invoice.id,
		organizationId,
		subscriptionId,
		amount: invoice.amount_paid,
	});

	// Log the event
	await logBillingEvent(eventId, "invoice.paid", organizationId, {
		invoiceId: invoice.id,
		subscriptionId,
		amount: invoice.amount_paid,
		currency: invoice.currency,
	});
}

/**
 * Handle invoice.payment_failed
 * This is triggered when a payment fails
 */
async function handleInvoicePaymentFailed(
	eventId: string,
	invoice: Stripe.Invoice,
): Promise<void> {
	const customerId =
		typeof invoice.customer === "string"
			? invoice.customer
			: invoice.customer?.id;

	if (!customerId) {
		logger.error("No customer ID in invoice", { invoiceId: invoice.id });
		return;
	}

	// Get organization from customer
	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId = organization?.id ?? null;

	// Get subscription ID from invoice
	const subscriptionId =
		typeof invoice.parent?.subscription_details?.subscription === "string"
			? invoice.parent.subscription_details.subscription
			: (invoice.parent?.subscription_details?.subscription ?? null);

	logger.warn("Invoice payment failed", {
		invoiceId: invoice.id,
		organizationId,
		subscriptionId,
		amount: invoice.amount_due,
	});

	// Log the event
	await logBillingEvent(eventId, "invoice.payment_failed", organizationId, {
		invoiceId: invoice.id,
		subscriptionId,
		amount: invoice.amount_due,
		currency: invoice.currency,
	});

	// Send notification email to organization admins about failed payment
	if (organizationId) {
		await sendPaymentFailedNotification({
			organizationId,
			amount: invoice.amount_due,
			currency: invoice.currency,
			invoiceId: invoice.id ?? undefined,
		});
	}
}

/**
 * Handle charge.refunded
 * This is triggered when a charge is refunded (important for one-time orders like lifetime)
 *
 * Access control policy:
 * - Full refunds: Revoke access by setting status to "refunded"
 * - Partial refunds: Keep access by keeping status as "completed"
 *   (partial refunds are typically goodwill gestures, not full cancellations)
 *
 * Credit purchase refunds:
 * - For full refunds of credit purchases, we reverse the credits granted
 * - Looks up original credit transaction by checkout session ID
 */
async function handleChargeRefunded(
	eventId: string,
	charge: Stripe.Charge,
): Promise<void> {
	const paymentIntentId =
		typeof charge.payment_intent === "string"
			? charge.payment_intent
			: charge.payment_intent?.id;

	if (!paymentIntentId) {
		logger.warn("No payment intent ID in charge refund", {
			chargeId: charge.id,
		});
		return;
	}

	// Try to get checkout session to check if this was a credit purchase
	// Credit purchases don't create orders, so we need to check separately
	let checkoutSession: Stripe.Checkout.Session | null = null;
	let isCreditPurchase = false;
	let creditPurchaseOrganizationId: string | null = null;

	try {
		const stripe = getStripe();
		// List checkout sessions for this payment intent
		const sessions = await stripe.checkout.sessions.list({
			payment_intent: paymentIntentId,
			limit: 1,
		});
		checkoutSession = sessions.data[0] ?? null;

		if (checkoutSession?.metadata?.type === "credit_purchase") {
			isCreditPurchase = true;
			creditPurchaseOrganizationId =
				checkoutSession.metadata.organizationId ?? null;
		}
	} catch (err) {
		logger.warn("Failed to fetch checkout session for refund", {
			chargeId: charge.id,
			paymentIntentId,
			error: err instanceof Error ? err.message : "Unknown error",
		});
	}

	// Handle credit purchase refunds
	if (isCreditPurchase && checkoutSession && charge.refunded) {
		await handleCreditPurchaseRefund(
			eventId,
			charge,
			checkoutSession,
			creditPurchaseOrganizationId,
		);
		return;
	}

	// Find the order associated with this payment intent (for non-credit purchases)
	const order = await getOrderByPaymentIntentId(paymentIntentId);

	if (!order) {
		logger.info("No order found for refunded charge", {
			chargeId: charge.id,
			paymentIntentId,
		});
		// Log the event anyway
		await logBillingEvent(eventId, "charge.refunded", null, {
			chargeId: charge.id,
			paymentIntentId,
			amount: charge.amount_refunded,
		});
		return;
	}

	// Only revoke access on FULL refunds
	// Partial refunds keep status as "completed" to maintain access
	// charge.refunded is true only when the full amount has been refunded
	if (charge.refunded) {
		await updateOrder(order.id, {
			status: OrderStatus.refunded,
		});

		logger.info("Order access revoked due to full refund", {
			orderId: order.id,
			organizationId: order.organizationId,
			chargeId: charge.id,
			amountRefunded: charge.amount_refunded,
			totalAmount: charge.amount,
		});
	} else {
		// Partial refund - log but don't revoke access
		logger.info("Partial refund processed, access maintained", {
			orderId: order.id,
			organizationId: order.organizationId,
			chargeId: charge.id,
			amountRefunded: charge.amount_refunded,
			totalAmount: charge.amount,
			refundPercentage: Math.round(
				(charge.amount_refunded / charge.amount) * 100,
			),
		});
	}

	// Log the event
	await logBillingEvent(
		eventId,
		"charge.refunded",
		order.organizationId,
		{
			chargeId: charge.id,
			paymentIntentId,
			orderId: order.id,
			amountRefunded: charge.amount_refunded,
			totalAmount: charge.amount,
			fullyRefunded: charge.refunded,
			accessRevoked: charge.refunded, // Only true for full refunds
		},
		undefined,
		order.id,
	);
}

/**
 * Handle refund for credit purchases
 * Reverses credits that were granted from the original purchase
 */
async function handleCreditPurchaseRefund(
	eventId: string,
	charge: Stripe.Charge,
	session: Stripe.Checkout.Session,
	organizationId: string | null,
): Promise<void> {
	if (!organizationId) {
		logger.error("No organization ID for credit purchase refund", {
			sessionId: session.id,
			chargeId: charge.id,
		});
		return;
	}

	// Check if already refunded (idempotency) - query by charge.id directly
	const [existingRefund] = await db
		.select()
		.from(creditTransactionTable)
		.where(
			and(
				eq(creditTransactionTable.organizationId, organizationId),
				eq(creditTransactionTable.referenceType, "credit_refund"),
				eq(creditTransactionTable.referenceId, charge.id),
			),
		)
		.limit(1);

	if (existingRefund) {
		logger.info("Credit refund already processed", {
			sessionId: session.id,
			chargeId: charge.id,
			organizationId,
		});
		return;
	}

	// Find the original credit transactions for this checkout session
	const creditTransactions = await db
		.select()
		.from(creditTransactionTable)
		.where(
			and(
				eq(creditTransactionTable.referenceId, session.id),
				sql`${creditTransactionTable.referenceType} IN ('checkout_session', 'checkout_session_bonus')`,
			),
		);

	if (creditTransactions.length === 0) {
		logger.warn("No credit transactions found for refunded checkout session", {
			sessionId: session.id,
			organizationId,
		});
		return;
	}

	// Calculate total credits to reverse
	const totalCreditsToReverse = creditTransactions.reduce(
		(sum, tx) => sum + tx.amount,
		0,
	);

	// Reverse the credits using proper refund function
	try {
		await reverseCredits({
			organizationId,
			amount: totalCreditsToReverse,
			description: `Refund: Credit purchase reversed (Session: ${session.id})`,
			referenceType: "credit_refund",
			referenceId: charge.id,
			metadata: {
				sessionId: session.id,
				originalTransactionIds: creditTransactions.map((tx) => tx.id),
			},
		});

		logger.info("Credits reversed due to refund", {
			organizationId,
			sessionId: session.id,
			chargeId: charge.id,
			creditsReversed: totalCreditsToReverse,
		});
	} catch (error) {
		// Log for manual review - reverseCredits handles partial reversals gracefully
		logger.error("Failed to reverse credits for refund", {
			organizationId,
			sessionId: session.id,
			chargeId: charge.id,
			creditsToReverse: totalCreditsToReverse,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}

	// Log the billing event
	await logBillingEvent(eventId, "charge.refunded", organizationId, {
		chargeId: charge.id,
		sessionId: session.id,
		type: "credit_purchase_refund",
		creditsReversed: totalCreditsToReverse,
		amountRefunded: charge.amount_refunded,
	});
}

/**
 * Handle customer.subscription.paused
 * This is triggered when a subscription is paused (requires payment collection pause to be enabled)
 */
async function handleSubscriptionPaused(
	eventId: string,
	webhookSubscription: Stripe.Subscription,
): Promise<void> {
	// Fetch fresh subscription data to avoid stale webhook data
	const subscription = await fetchFreshSubscription(webhookSubscription);

	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (subscription.metadata?.organizationId as string);

	// Update subscription status to paused
	const exists = await subscriptionExists(subscription.id);
	if (exists) {
		await updateSubscription(subscription.id, {
			status: SubscriptionStatus.paused,
		});
	}

	logger.info("Subscription paused", {
		subscriptionId: subscription.id,
		organizationId,
	});

	await logBillingEvent(
		eventId,
		"customer.subscription.paused",
		organizationId ?? null,
		{ subscriptionId: subscription.id },
		subscription.id,
	);
}

/**
 * Handle customer.subscription.resumed
 * This is triggered when a paused subscription is resumed
 */
async function handleSubscriptionResumed(
	eventId: string,
	webhookSubscription: Stripe.Subscription,
): Promise<void> {
	// Fetch fresh subscription data to avoid stale webhook data
	const subscription = await fetchFreshSubscription(webhookSubscription);

	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	const organization = await getOrganizationByStripeCustomerId(customerId);
	const organizationId =
		organization?.id ?? (subscription.metadata?.organizationId as string);

	// Update subscription status to active
	const exists = await subscriptionExists(subscription.id);
	if (exists) {
		await updateSubscription(subscription.id, {
			status: SubscriptionStatus.active,
		});
	}

	logger.info("Subscription resumed", {
		subscriptionId: subscription.id,
		organizationId,
	});

	await logBillingEvent(
		eventId,
		"customer.subscription.resumed",
		organizationId ?? null,
		{ subscriptionId: subscription.id },
		subscription.id,
	);
}

/**
 * Handle customer.deleted
 * This is triggered when a customer is deleted from Stripe
 * We clear the Stripe customer ID from the organization but keep the org
 */
async function handleCustomerDeleted(
	eventId: string,
	customer: Stripe.Customer | Stripe.DeletedCustomer,
): Promise<void> {
	const customerId = customer.id;

	const organization = await getOrganizationByStripeCustomerId(customerId);

	if (organization) {
		// Clear the Stripe customer ID from the organization
		// This allows the org to create a new customer if needed
		await db
			.update(organizationTable)
			.set({ stripeCustomerId: null })
			.where(eq(organizationTable.id, organization.id));

		logger.info("Customer deleted, cleared from organization", {
			customerId,
			organizationId: organization.id,
		});
	} else {
		logger.info("Customer deleted, no associated organization found", {
			customerId,
		});
	}

	await logBillingEvent(eventId, "customer.deleted", organization?.id ?? null, {
		customerId,
	});
}

/**
 * Handle payment_intent.succeeded
 * This is triggered when a payment intent is successfully completed.
 * Note: For checkout-based payments, checkout.session.completed is the primary handler.
 * This handler catches payments made outside of checkout (e.g., direct API payments,
 * payment links, or future integrations) and logs them for audit purposes.
 */
async function handlePaymentIntentSucceeded(
	eventId: string,
	paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
	const customerId =
		typeof paymentIntent.customer === "string"
			? paymentIntent.customer
			: paymentIntent.customer?.id;

	// Get organization if we have a customer
	let organizationId: string | null = null;
	if (customerId) {
		const organization = await getOrganizationByStripeCustomerId(customerId);
		organizationId = organization?.id ?? null;
	}

	// Check if this payment is already tracked via an order (from checkout)
	const existingOrder = await getOrderByPaymentIntentId(paymentIntent.id);

	if (existingOrder) {
		// Already handled by checkout.session.completed - just log for audit
		logger.info("Payment intent succeeded (already tracked via order)", {
			paymentIntentId: paymentIntent.id,
			orderId: existingOrder.id,
			organizationId,
		});
	} else {
		// Payment made outside checkout - log for visibility
		// This could be from a payment link, direct API call, or other integration
		logger.info("Payment intent succeeded (no associated order)", {
			paymentIntentId: paymentIntent.id,
			organizationId,
			amount: paymentIntent.amount,
			currency: paymentIntent.currency,
			metadata: paymentIntent.metadata,
		});
	}

	// Log the event for audit trail
	await logBillingEvent(
		eventId,
		"payment_intent.succeeded",
		organizationId,
		{
			paymentIntentId: paymentIntent.id,
			amount: paymentIntent.amount,
			currency: paymentIntent.currency,
			customerId,
			hasExistingOrder: !!existingOrder,
		},
		undefined,
		existingOrder?.id,
	);
}

/**
 * Handle refund.* events
 * These are more reliable than charge.refunded for tracking the refund lifecycle
 */
async function handleRefundEvent(
	eventId: string,
	eventType: string,
	refund: Stripe.Refund,
): Promise<void> {
	const chargeId =
		typeof refund.charge === "string" ? refund.charge : refund.charge?.id;

	const paymentIntentId =
		typeof refund.payment_intent === "string"
			? refund.payment_intent
			: refund.payment_intent?.id;

	logger.info("Refund event received", {
		eventType,
		refundId: refund.id,
		status: refund.status,
		amount: refund.amount,
		chargeId,
		paymentIntentId,
	});

	// For failed refunds, log as warning for visibility
	if (eventType === "refund.failed") {
		logger.warn("Refund failed", {
			refundId: refund.id,
			reason: refund.failure_reason,
			amount: refund.amount,
		});
	}

	// Get organization context if available
	let organizationId: string | null = null;
	if (paymentIntentId) {
		const order = await getOrderByPaymentIntentId(paymentIntentId);
		organizationId = order?.organizationId ?? null;
	}

	// Log the event
	await logBillingEvent(eventId, eventType, organizationId, {
		refundId: refund.id,
		status: refund.status,
		amount: refund.amount,
		currency: refund.currency,
		chargeId,
		paymentIntentId,
		failureReason: refund.failure_reason,
	});
}

/**
 * Handle charge.dispute.* events
 * Critical for chargeback management - disputes can result in fund loss
 */
async function handleDisputeEvent(
	eventId: string,
	eventType: string,
	dispute: Stripe.Dispute,
): Promise<void> {
	const chargeId =
		typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

	const paymentIntentId =
		typeof dispute.payment_intent === "string"
			? dispute.payment_intent
			: dispute.payment_intent?.id;

	// Disputes are always logged as warnings - they require attention
	logger.warn("Dispute event received", {
		eventType,
		disputeId: dispute.id,
		status: dispute.status,
		reason: dispute.reason,
		amount: dispute.amount,
		chargeId,
		paymentIntentId,
	});

	// Get organization context
	let organizationId: string | null = null;
	if (paymentIntentId) {
		const order = await getOrderByPaymentIntentId(paymentIntentId);
		organizationId = order?.organizationId ?? null;
	}

	// Send notification for new disputes - these need immediate attention
	if (eventType === "charge.dispute.created" && organizationId) {
		await sendDisputeNotification({
			organizationId,
			disputeId: dispute.id,
			reason: dispute.reason,
			amount: dispute.amount,
			currency: dispute.currency,
			evidenceDueBy: dispute.evidence_details?.due_by
				? new Date(dispute.evidence_details.due_by * 1000)
				: undefined,
		});
	}

	// Log the event
	await logBillingEvent(eventId, eventType, organizationId, {
		disputeId: dispute.id,
		status: dispute.status,
		reason: dispute.reason,
		amount: dispute.amount,
		currency: dispute.currency,
		chargeId,
		paymentIntentId,
		isChargeRefundable: dispute.is_charge_refundable,
	});
}

/**
 * Helper to log billing events using upsert to handle the case where
 * the event was already created at the start for idempotency
 */
async function logBillingEvent(
	stripeEventId: string,
	eventType: string,
	organizationId: string | null,
	eventData: Record<string, unknown>,
	subscriptionId?: string,
	orderId?: string,
): Promise<void> {
	try {
		await upsertBillingEvent({
			stripeEventId,
			eventType,
			organizationId,
			subscriptionId: subscriptionId ?? null,
			orderId: orderId ?? null,
			eventData: JSON.stringify(eventData),
			processed: true,
		});
	} catch (error) {
		// Log but don't fail - event logging is non-critical
		logger.error("Failed to log billing event", {
			stripeEventId,
			eventType,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}
