import "server-only";

import { eq, sql } from "drizzle-orm";
import { getPriceByStripePriceId } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { memberTable } from "@/lib/db/schema";
import { LoggerFactory } from "@/lib/logger/factory";
import {
	getActiveSubscriptionByOrganizationId,
	updateSubscription,
} from "./queries";
import { updateSubscriptionQuantity } from "./subscriptions";

const logger = LoggerFactory.getLogger("seat-sync");

/**
 * Lock namespace for seat sync operations.
 * Using a fixed high number to avoid collision with other potential advisory lock users.
 * The full lock key will be (SEAT_SYNC_LOCK_NAMESPACE, hash(organizationId)).
 */
const SEAT_SYNC_LOCK_NAMESPACE = 123456789;

/**
 * Convert organization ID (UUID string) to a numeric lock key.
 * Uses a simple hash function to convert UUID to a 32-bit integer.
 */
function organizationIdToLockKey(organizationId: string): number {
	let hash = 0;
	for (let i = 0; i < organizationId.length; i++) {
		const char = organizationId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

/**
 * Execute a function with a PostgreSQL advisory lock for the given organization.
 * This prevents race conditions when multiple seat sync operations run concurrently.
 *
 * Uses pg_try_advisory_lock which:
 * - Returns immediately (non-blocking)
 * - Returns true if lock acquired, false if already held
 * - Lock is automatically released when the connection is returned to pool
 *
 * @param organizationId - The organization ID to lock
 * @param fn - The function to execute while holding the lock
 * @param options - Lock options
 * @returns The result of fn, or null if lock couldn't be acquired
 */
async function withSeatSyncLock<T>(
	organizationId: string,
	fn: () => Promise<T>,
	options: {
		skipIfLocked?: boolean;
		maxRetries?: number;
		retryDelayMs?: number;
	} = {},
): Promise<
	| { success: true; result: T }
	| { success: false; reason: "locked" | "error"; error?: Error }
> {
	const { skipIfLocked = false, maxRetries = 3, retryDelayMs = 100 } = options;
	const lockKey = organizationIdToLockKey(organizationId);

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			// Try to acquire the advisory lock (non-blocking)
			const lockResult = await db.execute<{ acquired: boolean }>(
				sql`SELECT pg_try_advisory_lock(${SEAT_SYNC_LOCK_NAMESPACE}, ${lockKey}) as acquired`,
			);

			const acquired = lockResult.rows[0]?.acquired === true;

			if (!acquired) {
				if (skipIfLocked) {
					logger.debug("Seat sync skipped - another sync in progress", {
						organizationId,
						lockKey,
					});
					return { success: false, reason: "locked" };
				}

				// If not skipping, wait and retry
				if (attempt < maxRetries) {
					logger.debug("Seat sync lock busy, retrying", {
						organizationId,
						attempt: attempt + 1,
						maxRetries,
					});
					await new Promise((resolve) =>
						setTimeout(resolve, retryDelayMs * (attempt + 1)),
					);
					continue;
				}

				logger.warn("Seat sync lock could not be acquired after retries", {
					organizationId,
					attempts: attempt + 1,
				});
				return { success: false, reason: "locked" };
			}

			// Lock acquired, execute the function
			try {
				const result = await fn();
				return { success: true, result };
			} finally {
				// Always release the lock
				await db.execute(
					sql`SELECT pg_advisory_unlock(${SEAT_SYNC_LOCK_NAMESPACE}, ${lockKey})`,
				);
			}
		} catch (error) {
			logger.error("Error during seat sync lock operation", {
				organizationId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return {
				success: false,
				reason: "error",
				error: error instanceof Error ? error : new Error("Unknown error"),
			};
		}
	}

	return { success: false, reason: "locked" };
}

/**
 * Sync the subscription seat count with the actual member count.
 * This should be called whenever members are added or removed from an organization.
 *
 * **Race Condition Protection:**
 * Uses PostgreSQL advisory locks to prevent concurrent seat sync operations for the same
 * organization. If another sync is in progress, by default it will retry a few times.
 * Use `skipIfLocked: true` for fire-and-forget scenarios where you don't need to wait.
 *
 * **Consistency Model:**
 * - Stripe is the source of truth for billing
 * - The advisory lock ensures only one sync runs at a time per organization
 * - If member count changes during sync, it's logged but the next sync will correct it
 * - Stripe webhooks (customer.subscription.updated) provide additional reconciliation
 *
 * @param organizationId - The organization ID to sync seats for
 * @param options - Sync options
 * @returns Object with sync result details
 */
export async function syncOrganizationSeats(
	organizationId: string,
	options: { skipIfLocked?: boolean } = {},
): Promise<{
	synced: boolean;
	previousSeats: number;
	newSeats: number;
	message: string;
}> {
	const lockResult = await withSeatSyncLock(
		organizationId,
		async () => {
			// Get the active subscription
			const subscription =
				await getActiveSubscriptionByOrganizationId(organizationId);

			if (!subscription) {
				return {
					synced: false,
					previousSeats: 0,
					newSeats: 0,
					message: "No active subscription found",
				};
			}

			// Check if the plan supports seat-based billing
			const priceConfig = getPriceByStripePriceId(subscription.stripePriceId);
			if (!priceConfig) {
				return {
					synced: false,
					previousSeats: subscription.quantity,
					newSeats: subscription.quantity,
					message: "Price configuration not found",
				};
			}

			const isSeatBased =
				"seatBased" in priceConfig.price && priceConfig.price.seatBased;
			if (!isSeatBased) {
				return {
					synced: false,
					previousSeats: subscription.quantity,
					newSeats: subscription.quantity,
					message: "Plan does not use seat-based billing",
				};
			}

			const currentSeats = subscription.quantity;

			// Count current members - this is now safe because we hold the lock
			const members = await db
				.select({ id: memberTable.id })
				.from(memberTable)
				.where(eq(memberTable.organizationId, organizationId));

			const memberCount = members.length;

			// If counts match, no sync needed
			if (memberCount === currentSeats) {
				return {
					synced: false,
					previousSeats: currentSeats,
					newSeats: currentSeats,
					message: "Seats already in sync",
				};
			}

			// Update Stripe subscription quantity first (source of truth)
			// If this fails, we don't update our database to maintain consistency
			try {
				await updateSubscriptionQuantity(subscription.id, memberCount);
			} catch (stripeError) {
				logger.error("Failed to update Stripe subscription quantity", {
					organizationId,
					subscriptionId: subscription.id,
					error:
						stripeError instanceof Error
							? stripeError.message
							: "Unknown error",
				});
				throw stripeError;
			}

			// Update our database record with what we sent to Stripe
			await updateSubscription(subscription.id, {
				quantity: memberCount,
			});

			logger.info("Synced organization seats", {
				organizationId,
				previousSeats: currentSeats,
				newSeats: memberCount,
				subscriptionId: subscription.id,
			});

			return {
				synced: true,
				previousSeats: currentSeats,
				newSeats: memberCount,
				message: `Updated from ${currentSeats} to ${memberCount} seats`,
			};
		},
		{ skipIfLocked: options.skipIfLocked },
	);

	if (lockResult.success) {
		return lockResult.result;
	}

	// Lock acquisition failed
	if (lockResult.reason === "locked") {
		logger.debug("Seat sync skipped - concurrent sync in progress", {
			organizationId,
		});
		return {
			synced: false,
			previousSeats: 0,
			newSeats: 0,
			message: "Sync skipped - another sync in progress",
		};
	}

	// Error case
	throw lockResult.error ?? new Error("Unknown error during seat sync");
}

/**
 * Check if an organization's seat count needs syncing
 */
export async function checkSeatSyncNeeded(organizationId: string): Promise<{
	needsSync: boolean;
	currentSeats: number;
	memberCount: number;
	difference: number;
}> {
	const subscription =
		await getActiveSubscriptionByOrganizationId(organizationId);

	if (!subscription) {
		return {
			needsSync: false,
			currentSeats: 0,
			memberCount: 0,
			difference: 0,
		};
	}

	// Check if seat-based
	const priceConfig = getPriceByStripePriceId(subscription.stripePriceId);
	const isSeatBased =
		priceConfig &&
		"seatBased" in priceConfig.price &&
		priceConfig.price.seatBased;

	if (!isSeatBased) {
		return {
			needsSync: false,
			currentSeats: subscription.quantity,
			memberCount: 0,
			difference: 0,
		};
	}

	// Count members
	const members = await db
		.select({ id: memberTable.id })
		.from(memberTable)
		.where(eq(memberTable.organizationId, organizationId));

	const memberCount = members.length;
	const currentSeats = subscription.quantity;

	return {
		needsSync: memberCount !== currentSeats,
		currentSeats,
		memberCount,
		difference: memberCount - currentSeats,
	};
}

/**
 * Get the minimum required seats for an organization based on member count.
 * Useful for validation before allowing member removal.
 */
export async function getMinimumRequiredSeats(
	organizationId: string,
): Promise<number> {
	const members = await db
		.select({ id: memberTable.id })
		.from(memberTable)
		.where(eq(memberTable.organizationId, organizationId));

	// Minimum is always at least 1 (the owner)
	return Math.max(1, members.length);
}
