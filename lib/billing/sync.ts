import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { creditPackages } from "@/config/billing.config";
import { addCredits } from "@/lib/billing/credits";
import {
	createSubscription,
	stripeItemsToDb,
	stripeSubscriptionToDb,
	syncSubscriptionItems,
} from "@/lib/billing/queries";
import { getStripe } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import {
	creditTransactionTable,
	organizationTable,
	subscriptionTable,
} from "@/lib/db/schema";
import {
	type BillingInterval,
	CreditTransactionType,
	type SubscriptionStatus,
} from "@/lib/db/schema/enums";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export type SyncResult = {
	subscriptionId: string;
	organizationId: string;
	organizationName: string | null;
	success: boolean;
	error?: string;
};

export type BulkSyncResult = {
	totalRequested: number;
	successful: number;
	failed: number;
	skipped: number;
	results: SyncResult[];
	durationMs: number;
};

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a Stripe error is a "resource not found" error
 */
function isStripeNotFoundError(error: unknown): boolean {
	if (typeof error === "object" && error !== null) {
		const err = error as { code?: string; type?: string };
		return (
			err.code === "resource_missing" || err.type === "invalid_request_error"
		);
	}
	return false;
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Sync selected subscriptions from Stripe
 * Fetches fresh data from Stripe and updates local database
 *
 * @param subscriptionIds - Array of Stripe subscription IDs to sync (max 100)
 * @returns Bulk sync result with details for each subscription
 */
export async function syncSelectedSubscriptions(
	subscriptionIds: string[],
): Promise<BulkSyncResult> {
	const startTime = Date.now();

	const result: BulkSyncResult = {
		totalRequested: subscriptionIds.length,
		successful: 0,
		failed: 0,
		skipped: 0,
		results: [],
		durationMs: 0,
	};

	if (subscriptionIds.length === 0) {
		result.durationMs = Date.now() - startTime;
		return result;
	}

	// Enforce max limit
	if (subscriptionIds.length > 100) {
		throw new Error("Cannot sync more than 100 subscriptions at once");
	}

	logger.info(
		{ count: subscriptionIds.length },
		"Starting subscription sync from Stripe",
	);

	// Get local subscription data with organization info in a single query
	const localSubscriptions = await db
		.select({
			id: subscriptionTable.id,
			organizationId: subscriptionTable.organizationId,
			organizationName: organizationTable.name,
		})
		.from(subscriptionTable)
		.leftJoin(
			organizationTable,
			eq(subscriptionTable.organizationId, organizationTable.id),
		)
		.where(inArray(subscriptionTable.id, subscriptionIds));

	// Create lookup map
	const localSubMap = new Map(localSubscriptions.map((s) => [s.id, s]));

	// Get Stripe client
	const stripe = getStripe();

	// Process each subscription with index-based loop (avoid O(n²))
	for (let i = 0; i < subscriptionIds.length; i++) {
		const subscriptionId = subscriptionIds[i]!;
		const localSub = localSubMap.get(subscriptionId);

		const syncResult: SyncResult = {
			subscriptionId,
			organizationId: localSub?.organizationId ?? "",
			organizationName: localSub?.organizationName ?? null,
			success: false,
		};

		// Skip if subscription doesn't exist locally
		if (!localSub) {
			syncResult.error = "Subscription not found in local database";
			result.skipped++;
			result.results.push(syncResult);
			continue;
		}

		try {
			// Fetch fresh data from Stripe
			const stripeSubscription = await stripe.subscriptions.retrieve(
				subscriptionId,
				{
					expand: ["default_payment_method", "items.data.price"],
				},
			);

			// Transform and upsert subscription
			const dbData = stripeSubscriptionToDb(
				stripeSubscription,
				localSub.organizationId,
			);
			await createSubscription(dbData);

			// Sync subscription items
			const itemsData = stripeItemsToDb(
				stripeSubscription.id,
				stripeSubscription.items.data,
			);
			await syncSubscriptionItems(stripeSubscription.id, itemsData);

			syncResult.success = true;
			result.successful++;

			logger.debug(
				{
					subscriptionId,
					organizationId: localSub.organizationId,
					status: stripeSubscription.status,
				},
				"Subscription synced from Stripe",
			);
		} catch (error) {
			// Handle Stripe "not found" errors specifically
			if (isStripeNotFoundError(error)) {
				syncResult.error =
					"Subscription not found in Stripe (may have been deleted)";
			} else {
				syncResult.error =
					error instanceof Error ? error.message : "Unknown error";
			}
			result.failed++;

			logger.error(
				{
					error: error instanceof Error ? error.message : error,
					stack: error instanceof Error ? error.stack : undefined,
					subscriptionId,
				},
				"Failed to sync subscription from Stripe",
			);
		}

		result.results.push(syncResult);

		// Small delay between requests to avoid rate limiting (not on last item)
		if (i < subscriptionIds.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	result.durationMs = Date.now() - startTime;

	logger.info(
		{
			total: result.totalRequested,
			successful: result.successful,
			failed: result.failed,
			skipped: result.skipped,
			durationMs: result.durationMs,
		},
		"Subscription sync completed",
	);

	return result;
}

/**
 * Sync all subscriptions for selected organizations from Stripe
 * Fetches fresh data from Stripe based on customer ID and updates local database
 *
 * @param organizationIds - Array of Organization IDs to sync
 * @returns Bulk sync result with details for each subscription process
 */
export async function syncOrganizationSubscriptions(
	organizationIds: string[],
): Promise<BulkSyncResult> {
	const startTime = Date.now();

	const result: BulkSyncResult = {
		totalRequested: organizationIds.length,
		successful: 0,
		failed: 0,
		skipped: 0,
		results: [],
		durationMs: 0,
	};

	if (organizationIds.length === 0) {
		result.durationMs = Date.now() - startTime;
		return result;
	}

	logger.info(
		{ count: organizationIds.length },
		"Starting organization subscription sync from Stripe",
	);

	// Get organizations to find stripeCustomerId
	const organizations = await db
		.select({
			id: organizationTable.id,
			name: organizationTable.name,
			stripeCustomerId: organizationTable.stripeCustomerId,
		})
		.from(organizationTable)
		.where(inArray(organizationTable.id, organizationIds));

	// Create lookup map
	const orgMap = new Map(organizations.map((o) => [o.id, o]));

	// Get Stripe client
	const stripe = getStripe();

	// Process each organization
	for (const orgId of organizationIds) {
		const org = orgMap.get(orgId);
		const syncResult: SyncResult = {
			subscriptionId: "organization-sync", // Placeholder
			organizationId: orgId,
			organizationName: org?.name ?? null,
			success: false,
		};

		if (!org) {
			syncResult.error = "Organization not found";
			result.failed++;
			result.results.push(syncResult);
			continue;
		}

		if (!org.stripeCustomerId) {
			syncResult.error = "No Stripe Customer ID found for organization";
			result.skipped++;
			result.results.push(syncResult);
			continue;
		}

		try {
			// Fetch all subscriptions for this customer
			// We use status: 'all' to get everything including canceled ones
			const stripeSubscriptions = await stripe.subscriptions.list({
				customer: org.stripeCustomerId,
				status: "all",
				expand: ["data.default_payment_method"],
				limit: 100, // Should be enough for one customer
			});

			if (stripeSubscriptions.data.length === 0) {
				// No subscriptions found, but successful sync check
				syncResult.success = true;
				result.successful++;
				result.results.push(syncResult);
				continue;
			}

			// Sync each subscription found
			for (const sub of stripeSubscriptions.data) {
				// Transform and upsert subscription
				const dbData = stripeSubscriptionToDb(sub, orgId);
				await createSubscription(dbData);

				// Sync subscription items
				const itemsData = stripeItemsToDb(sub.id, sub.items.data);
				await syncSubscriptionItems(sub.id, itemsData);
			}

			syncResult.success = true;
			result.successful++;

			logger.info(
				{
					organizationId: orgId,
					subscriptionCount: stripeSubscriptions.data.length,
				},
				"Organization subscriptions synced from Stripe",
			);
		} catch (error) {
			syncResult.error =
				error instanceof Error
					? error.message
					: "Unknown error syncing customer";
			result.failed++;
			logger.error(
				{
					error: error instanceof Error ? error.message : error,
					stack: error instanceof Error ? error.stack : undefined,
					organizationId: orgId,
					stripeCustomerId: org.stripeCustomerId,
				},
				"Failed to sync organization subscriptions from Stripe",
			);
		}

		result.results.push(syncResult);
	}

	result.durationMs = Date.now() - startTime;
	return result;
}

/**
 * Sync all completed credit purchases for selected organizations from Stripe
 * Reconciles any missed credit purchases that might have occurred due to webhook failures
 *
 * @param organizationIds - Array of Organization IDs to sync
 * @returns Bulk sync result with details for each processed organization
 */
export async function syncOrganizationOrders(
	organizationIds: string[],
): Promise<BulkSyncResult> {
	const startTime = Date.now();

	const result: BulkSyncResult = {
		totalRequested: organizationIds.length,
		successful: 0,
		failed: 0,
		skipped: 0,
		results: [],
		durationMs: 0,
	};

	if (organizationIds.length === 0) {
		result.durationMs = Date.now() - startTime;
		return result;
	}

	logger.info(
		{ count: organizationIds.length },
		"Starting organization order sync (credit purchases) from Stripe",
	);

	// Get organizations to find stripeCustomerId
	const organizations = await db
		.select({
			id: organizationTable.id,
			name: organizationTable.name,
			stripeCustomerId: organizationTable.stripeCustomerId,
		})
		.from(organizationTable)
		.where(inArray(organizationTable.id, organizationIds));

	const orgMap = new Map(organizations.map((o) => [o.id, o]));
	const stripe = getStripe();

	for (const orgId of organizationIds) {
		const org = orgMap.get(orgId);
		const syncResult: SyncResult = {
			subscriptionId: "order-sync",
			organizationId: orgId,
			organizationName: org?.name ?? null,
			success: false,
		};

		if (!org) {
			syncResult.error = "Organization not found";
			result.failed++;
			result.results.push(syncResult);
			continue;
		}

		if (!org.stripeCustomerId) {
			syncResult.error = "No Stripe Customer ID found for organization";
			result.skipped++;
			result.results.push(syncResult);
			continue;
		}

		try {
			// Fetch completed checkout sessions for this customer
			const sessions = await stripe.checkout.sessions.list({
				customer: org.stripeCustomerId,
				status: "complete",
				limit: 100,
			});

			let orgPurchasesSynced = 0;

			for (const session of sessions.data) {
				// Only process credit purchases
				if (session.metadata?.type !== "credit_purchase") {
					continue;
				}

				const packageId = session.metadata.packageId;
				const userId = session.metadata.userId;

				if (!packageId) {
					logger.warn(
						{ sessionId: session.id, organizationId: orgId },
						"Credit purchase session missing packageId in metadata, skipping",
					);
					continue;
				}

				// Check if this session has already been processed in the credit transactions
				const [existingTx] = await db
					.select({ id: creditTransactionTable.id })
					.from(creditTransactionTable)
					.where(
						and(
							eq(creditTransactionTable.organizationId, orgId),
							eq(creditTransactionTable.referenceType, "checkout_session"),
							eq(creditTransactionTable.referenceId, session.id),
						),
					)
					.limit(1);

				if (existingTx) {
					// Already processed
					continue;
				}

				// Not processed, reconcile it
				const pkg = creditPackages.find((p) => p.id === packageId);
				if (!pkg) {
					logger.error(
						{ packageId, sessionId: session.id },
						"Unknown credit package in sync, cannot reconcile",
					);
					continue;
				}

				// Add base credits
				await addCredits({
					organizationId: orgId,
					amount: pkg.credits,
					type: CreditTransactionType.purchase,
					description: `Purchased ${pkg.name} credit package (Synced)`,
					referenceType: "checkout_session",
					referenceId: session.id,
					createdBy: userId ?? undefined,
					metadata: {
						packageId,
						amountPaid: session.amount_total,
						stripeSessionId: session.id,
						reconciledViaSync: true,
					},
				});

				// Add bonus credits if applicable
				if (pkg.bonusCredits > 0) {
					await addCredits({
						organizationId: orgId,
						amount: pkg.bonusCredits,
						type: CreditTransactionType.bonus,
						description: `${pkg.name} package bonus credits (Synced)`,
						referenceType: "checkout_session_bonus",
						referenceId: session.id,
						createdBy: userId ?? undefined,
						metadata: {
							packageId,
							stripeSessionId: session.id,
							reconciledViaSync: true,
						},
					});
				}

				orgPurchasesSynced++;
				logger.info(
					{
						organizationId: orgId,
						sessionId: session.id,
						packageId,
					},
					"Reconciled missed credit purchase via sync",
				);
			}

			syncResult.success = true;
			result.successful++;
			if (orgPurchasesSynced > 0) {
				logger.info(
					{ organizationId: orgId, reconciledCount: orgPurchasesSynced },
					"Organization order sync completed with reconciliations",
				);
			}
		} catch (error) {
			syncResult.error =
				error instanceof Error ? error.message : "Unknown error syncing orders";
			result.failed++;
			logger.error(
				{
					error: error instanceof Error ? error.message : error,
					organizationId: orgId,
				},
				"Failed to sync organization orders from Stripe",
			);
		}

		result.results.push(syncResult);
	}

	result.durationMs = Date.now() - startTime;
	return result;
}
