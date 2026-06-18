import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	creditBalanceTable,
	creditDeductionFailureTable,
	creditTransactionTable,
} from "@/lib/db/schema";
import { CreditTransactionType } from "@/lib/db/schema/enums";
import { LoggerFactory } from "@/lib/logger/factory";

const logger = LoggerFactory.getLogger("credits");

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_METADATA_SIZE = 10 * 1024; // 10KB max for metadata JSON

// ============================================================================
// TYPES
// ============================================================================

export type CreditBalanceSelect = typeof creditBalanceTable.$inferSelect;
export type CreditTransactionSelect =
	typeof creditTransactionTable.$inferSelect;
export type CreditTransactionInsert =
	typeof creditTransactionTable.$inferInsert;

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base error class for credit operations
 */
export class CreditError extends Error {
	public readonly code: string;
	public readonly userMessage: string;

	constructor(code: string, message: string, userMessage: string) {
		super(message);
		this.name = "CreditError";
		this.code = code;
		this.userMessage = userMessage;
	}
}

/**
 * Thrown when user doesn't have enough credits
 */
export class InsufficientCreditsError extends CreditError {
	constructor(
		public available: number,
		public required: number,
	) {
		super(
			"INSUFFICIENT_CREDITS",
			`Insufficient credits: ${available} available, ${required} required`,
			"You don't have enough credits. Please purchase more credits to continue.",
		);
		this.name = "InsufficientCreditsError";
	}
}

/**
 * Thrown when credit amount is invalid
 */
export class InvalidCreditAmountError extends CreditError {
	constructor(message: string) {
		super("INVALID_AMOUNT", message, "Please enter a valid credit amount.");
		this.name = "InvalidCreditAmountError";
	}
}

/**
 * Thrown when metadata is too large
 */
export class MetadataTooLargeError extends CreditError {
	constructor(size: number) {
		super(
			"METADATA_TOO_LARGE",
			`Metadata too large: ${size} bytes (max ${MAX_METADATA_SIZE})`,
			"The provided data is too large.",
		);
		this.name = "MetadataTooLargeError";
	}
}

/**
 * Thrown when credit balance operation fails
 */
export class CreditBalanceError extends CreditError {
	constructor(message: string) {
		super(
			"BALANCE_ERROR",
			message,
			"Unable to process credit operation. Please try again.",
		);
		this.name = "CreditBalanceError";
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Maximum length for description field */
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Sanitize description text to prevent XSS and limit length
 * - Escapes HTML special characters
 * - Trims and limits to MAX_DESCRIPTION_LENGTH
 */
function sanitizeDescription(description: string | undefined): string | null {
	if (!description) return null;

	// Escape HTML special characters to prevent XSS if rendered in UI
	const escaped = description
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;");

	// Trim and limit length
	return escaped.trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Validate and serialize metadata
 * Throws MetadataTooLargeError if too large
 */
function validateAndSerializeMetadata(
	metadata: Record<string, unknown> | undefined,
): string | null {
	if (!metadata) return null;
	const json = JSON.stringify(metadata);
	if (json.length > MAX_METADATA_SIZE) {
		throw new MetadataTooLargeError(json.length);
	}
	return json;
}

// ============================================================================
// BALANCE OPERATIONS
// ============================================================================

/**
 * Get credit balance for an organization
 * Creates balance record if it doesn't exist using atomic upsert
 */
export async function getCreditBalance(
	organizationId: string,
): Promise<CreditBalanceSelect> {
	// Use atomic upsert to handle race conditions
	// ON CONFLICT DO UPDATE with a no-op ensures we always get the row back
	const [balance] = await db
		.insert(creditBalanceTable)
		.values({ organizationId })
		.onConflictDoUpdate({
			target: creditBalanceTable.organizationId,
			set: { updatedAt: new Date() }, // No-op update to return existing row
		})
		.returning();

	if (!balance) {
		throw new CreditBalanceError("Failed to get or create credit balance");
	}

	return balance;
}

/**
 * Check if organization has enough credits
 */
export async function hasEnoughCredits(
	organizationId: string,
	required: number,
): Promise<boolean> {
	const balance = await getCreditBalance(organizationId);
	return balance.balance >= required;
}

// ============================================================================
// CREDIT OPERATIONS
// ============================================================================

/**
 * Add credits to an organization (purchase, grant, bonus, etc.)
 * Uses a transaction for atomic balance update + ledger entry
 */
export async function addCredits(params: {
	organizationId: string;
	amount: number;
	type: CreditTransactionType;
	description: string;
	referenceType?: string;
	referenceId?: string;
	createdBy?: string;
	metadata?: Record<string, unknown>;
}): Promise<CreditTransactionSelect> {
	const {
		organizationId,
		amount,
		type,
		description,
		referenceType,
		referenceId,
		createdBy,
		metadata,
	} = params;

	if (amount <= 0) {
		throw new InvalidCreditAmountError("Credit amount must be positive");
	}

	// Validate metadata size
	const serializedMetadata = validateAndSerializeMetadata(metadata);

	return db.transaction(async (tx) => {
		// Get or create balance with row lock to prevent race conditions
		let [balance] = await tx
			.select()
			.from(creditBalanceTable)
			.where(eq(creditBalanceTable.organizationId, organizationId))
			.for("update");

		if (!balance) {
			// Create balance record if it doesn't exist
			const [newBalanceRecord] = await tx
				.insert(creditBalanceTable)
				.values({ organizationId })
				.returning();
			balance = newBalanceRecord;
		}

		if (!balance) {
			throw new CreditBalanceError("Failed to get credit balance");
		}

		const newBalance = balance.balance + amount;

		// Update balance based on type
		const updates: Partial<typeof creditBalanceTable.$inferInsert> = {
			balance: newBalance,
		};

		if (type === CreditTransactionType.purchase) {
			updates.lifetimePurchased = balance.lifetimePurchased + amount;
		} else if (
			type === CreditTransactionType.bonus ||
			type === CreditTransactionType.promo ||
			type === CreditTransactionType.subscriptionGrant
		) {
			updates.lifetimeGranted = balance.lifetimeGranted + amount;
		}

		await tx
			.update(creditBalanceTable)
			.set(updates)
			.where(eq(creditBalanceTable.organizationId, organizationId));

		// Record transaction
		const [transaction] = await tx
			.insert(creditTransactionTable)
			.values({
				organizationId,
				type,
				amount,
				balanceAfter: newBalance,
				description: sanitizeDescription(description),
				referenceType,
				referenceId,
				createdBy,
				metadata: serializedMetadata,
			})
			.returning();

		if (!transaction) {
			throw new CreditBalanceError("Failed to create credit transaction");
		}

		logger.info({ organizationId, type, amount, newBalance }, "Credits added");

		return transaction;
	});
}

/**
 * Consume credits for AI operations
 * Atomic deduction with insufficient balance check
 */
export async function consumeCredits(params: {
	organizationId: string;
	amount: number;
	description: string;
	model?: string;
	inputTokens?: number;
	outputTokens?: number;
	referenceType?: string;
	referenceId?: string;
	createdBy?: string;
	metadata?: Record<string, unknown>;
}): Promise<{
	transaction: CreditTransactionSelect;
	remainingBalance: number;
}> {
	const {
		organizationId,
		amount,
		description,
		model,
		inputTokens,
		outputTokens,
		referenceType,
		referenceId,
		createdBy,
		metadata,
	} = params;

	if (amount <= 0) {
		throw new InvalidCreditAmountError("Usage amount must be positive");
	}

	// Validate metadata size
	const serializedMetadata = validateAndSerializeMetadata(metadata);

	return db.transaction(async (tx) => {
		// Get balance with row lock to prevent race conditions
		const [balance] = await tx
			.select()
			.from(creditBalanceTable)
			.where(eq(creditBalanceTable.organizationId, organizationId))
			.for("update");

		if (!balance) {
			throw new InsufficientCreditsError(0, amount);
		}

		if (balance.balance < amount) {
			throw new InsufficientCreditsError(balance.balance, amount);
		}

		const newBalance = balance.balance - amount;

		// Update balance
		await tx
			.update(creditBalanceTable)
			.set({
				balance: newBalance,
				lifetimeUsed: balance.lifetimeUsed + amount,
			})
			.where(eq(creditBalanceTable.organizationId, organizationId));

		// Record transaction
		const [transaction] = await tx
			.insert(creditTransactionTable)
			.values({
				organizationId,
				type: CreditTransactionType.usage,
				amount: -amount, // Negative for deduction
				balanceAfter: newBalance,
				description: sanitizeDescription(description),
				model,
				inputTokens,
				outputTokens,
				referenceType,
				referenceId,
				createdBy,
				metadata: serializedMetadata,
			})
			.returning();

		if (!transaction) {
			throw new CreditBalanceError("Failed to create credit transaction");
		}

		logger.info({ organizationId, amount, model, newBalance }, "Credits used");

		return { transaction, remainingBalance: newBalance };
	});
}

/**
 * Reverse credits due to refund
 * Creates a negative transaction with proper 'refund' type for audit trail
 * Does NOT throw on insufficient balance - logs warning and proceeds
 */
export async function reverseCredits(params: {
	organizationId: string;
	amount: number;
	description: string;
	referenceType: string;
	referenceId: string;
	metadata?: Record<string, unknown>;
}): Promise<CreditTransactionSelect> {
	const {
		organizationId,
		amount,
		description,
		referenceType,
		referenceId,
		metadata,
	} = params;

	if (amount <= 0) {
		throw new InvalidCreditAmountError("Reversal amount must be positive");
	}

	// Validate metadata size
	const serializedMetadata = validateAndSerializeMetadata(metadata);

	return db.transaction(async (tx) => {
		// Get balance with row lock
		const [balance] = await tx
			.select()
			.from(creditBalanceTable)
			.where(eq(creditBalanceTable.organizationId, organizationId))
			.for("update");

		if (!balance) {
			throw new CreditBalanceError("Credit balance not found for organization");
		}

		// Calculate new balance - allow going to 0 but not negative
		// If user spent some credits, we can only reverse what's left
		const actualReversal = Math.min(amount, balance.balance);
		const newBalance = balance.balance - actualReversal;

		if (actualReversal < amount) {
			logger.warn(
				{
					organizationId,
					requestedReversal: amount,
					actualReversal,
					currentBalance: balance.balance,
				},
				"Partial credit reversal - user spent some credits",
			);
		}

		// Update balance - decrement lifetimePurchased since this reverses a purchase
		await tx
			.update(creditBalanceTable)
			.set({
				balance: newBalance,
				// Decrement lifetimePurchased to reflect the refund
				lifetimePurchased: Math.max(
					0,
					balance.lifetimePurchased - actualReversal,
				),
			})
			.where(eq(creditBalanceTable.organizationId, organizationId));

		// Record transaction with proper refund type
		const [transaction] = await tx
			.insert(creditTransactionTable)
			.values({
				organizationId,
				type: CreditTransactionType.refund,
				amount: -actualReversal, // Negative for deduction
				balanceAfter: newBalance,
				description: sanitizeDescription(description),
				referenceType,
				referenceId,
				metadata: serializedMetadata,
			})
			.returning();

		if (!transaction) {
			throw new CreditBalanceError("Failed to create refund transaction");
		}

		logger.info(
			{
				organizationId,
				requestedAmount: amount,
				actualReversed: actualReversal,
				newBalance,
				referenceId,
			},
			"Credits reversed due to refund",
		);

		return transaction;
	});
}

/**
 * Admin adjustment (can add or remove credits)
 */
export async function adjustCredits(params: {
	organizationId: string;
	amount: number; // Positive to add, negative to remove
	description: string;
	createdBy: string;
	metadata?: Record<string, unknown>;
}): Promise<CreditTransactionSelect> {
	const { organizationId, amount, description, createdBy, metadata } = params;

	if (amount === 0) {
		throw new InvalidCreditAmountError("Adjustment amount cannot be zero");
	}

	// Validate metadata size
	const serializedMetadata = validateAndSerializeMetadata(metadata);

	return db.transaction(async (tx) => {
		const [balance] = await tx
			.select()
			.from(creditBalanceTable)
			.where(eq(creditBalanceTable.organizationId, organizationId))
			.for("update");

		if (!balance) {
			throw new CreditBalanceError("Credit balance not found for organization");
		}

		const newBalance = balance.balance + amount;

		if (newBalance < 0) {
			throw new InvalidCreditAmountError(
				"Adjustment would result in negative balance",
			);
		}

		await tx
			.update(creditBalanceTable)
			.set({ balance: newBalance })
			.where(eq(creditBalanceTable.organizationId, organizationId));

		const [transaction] = await tx
			.insert(creditTransactionTable)
			.values({
				organizationId,
				type: CreditTransactionType.adjustment,
				amount,
				balanceAfter: newBalance,
				description: sanitizeDescription(description),
				referenceType: "admin",
				createdBy,
				metadata: serializedMetadata,
			})
			.returning();

		if (!transaction) {
			throw new CreditBalanceError("Failed to create credit transaction");
		}

		logger.info(
			{ organizationId, amount, newBalance, createdBy },
			"Credits adjusted",
		);

		return transaction;
	});
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * List credit transactions for an organization
 */
export async function listCreditTransactions(
	organizationId: string,
	options?: { limit?: number; offset?: number; type?: CreditTransactionType },
): Promise<CreditTransactionSelect[]> {
	const conditions = [
		eq(creditTransactionTable.organizationId, organizationId),
	];

	if (options?.type) {
		conditions.push(eq(creditTransactionTable.type, options.type));
	}

	return db.query.creditTransactionTable.findMany({
		where: and(...conditions),
		orderBy: [desc(creditTransactionTable.createdAt)],
		limit: options?.limit ?? 50,
		offset: options?.offset,
	});
}

// ============================================================================
// CREDIT COST CALCULATION
// ============================================================================

import { type CreditModel, creditCosts } from "@/config/billing.config";

export type { CreditModel };

/**
 * Calculate credit cost for AI usage
 */
export function calculateCreditCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
): number {
	const costs = creditCosts[model as CreditModel];
	if (!costs) {
		// Default to gpt-4o-mini pricing for unknown models
		logger.warn({ model }, "Unknown model, using default pricing");
		const defaultCosts = creditCosts["gpt-4o-mini"];
		const inputCost = Math.ceil((inputTokens / 1000) * defaultCosts.input);
		const outputCost = Math.ceil((outputTokens / 1000) * defaultCosts.output);
		return Math.max(1, inputCost + outputCost); // Minimum 1 credit
	}

	const inputCost = Math.ceil((inputTokens / 1000) * costs.input);
	const outputCost = Math.ceil((outputTokens / 1000) * costs.output);

	return Math.max(1, inputCost + outputCost); // Minimum 1 credit
}

// ============================================================================
// TOKEN ESTIMATION CONSTANTS
// ============================================================================

/** Average characters per token for English text (GPT-style tokenization) */
const CHARS_PER_TOKEN = 4;

/** Minimum expected output tokens for any chat response */
const MIN_OUTPUT_TOKENS = 500;

/** Typical output/input ratio for conversational chat */
const OUTPUT_TO_INPUT_RATIO = 0.7;

/** Safety buffer multiplier to avoid insufficient credits mid-stream (20%) */
const ESTIMATION_BUFFER = 1.2;

/**
 * Estimate credit cost for a message (before sending)
 * Uses a smarter estimation based on input size with safety buffer
 */
export function estimateCreditCost(
	model: string,
	messages: Array<{ content: string }>,
): number {
	const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
	const estimatedInputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);

	// Estimate output based on input (typically 0.5-1.5x input for chat)
	const estimatedOutputTokens = Math.max(
		MIN_OUTPUT_TOKENS,
		Math.ceil(estimatedInputTokens * OUTPUT_TO_INPUT_RATIO),
	);

	// Add buffer for safety to avoid insufficient credits mid-stream
	const bufferedInput = Math.ceil(estimatedInputTokens * ESTIMATION_BUFFER);
	const bufferedOutput = Math.ceil(estimatedOutputTokens * ESTIMATION_BUFFER);

	return calculateCreditCost(model, bufferedInput, bufferedOutput);
}

// ============================================================================
// FAILED DEDUCTION TRACKING
// ============================================================================

/**
 * Log a failed credit deduction for later reconciliation
 * Called when credit deduction fails after AI response is already sent
 */
export async function logFailedDeduction(params: {
	organizationId: string;
	amount: number;
	errorCode: string;
	errorMessage?: string;
	model?: string;
	inputTokens?: number;
	outputTokens?: number;
	referenceType?: string;
	referenceId?: string;
	userId?: string;
}): Promise<void> {
	const {
		organizationId,
		amount,
		errorCode,
		errorMessage,
		model,
		inputTokens,
		outputTokens,
		referenceType,
		referenceId,
		userId,
	} = params;

	try {
		await db.insert(creditDeductionFailureTable).values({
			organizationId,
			amount,
			errorCode,
			errorMessage,
			model,
			inputTokens,
			outputTokens,
			referenceType,
			referenceId,
			userId,
		});

		logger.warn(
			{
				organizationId,
				amount,
				errorCode,
				model,
				referenceType,
				referenceId,
			},
			"Credit deduction failure logged for reconciliation",
		);
	} catch (error) {
		// Log but don't throw - this is best-effort tracking
		logger.error(
			{ error, organizationId, amount },
			"Failed to log credit deduction failure",
		);
	}
}

/**
 * Get unresolved deduction failures for an organization (admin use)
 */
export async function getUnresolvedDeductionFailures(
	organizationId?: string,
	options?: { limit?: number },
): Promise<Array<typeof creditDeductionFailureTable.$inferSelect>> {
	const conditions = [eq(creditDeductionFailureTable.resolved, false)];

	if (organizationId) {
		conditions.push(
			eq(creditDeductionFailureTable.organizationId, organizationId),
		);
	}

	return db.query.creditDeductionFailureTable.findMany({
		where: and(...conditions),
		orderBy: [desc(creditDeductionFailureTable.createdAt)],
		limit: options?.limit ?? 100,
	});
}

/**
 * Mark a deduction failure as resolved
 */
export async function resolveDeductionFailure(
	failureId: string,
	resolvedBy: string,
	notes?: string,
): Promise<void> {
	await db
		.update(creditDeductionFailureTable)
		.set({
			resolved: true,
			resolvedAt: new Date(),
			resolvedBy,
			resolutionNotes: notes,
		})
		.where(eq(creditDeductionFailureTable.id, failureId));
}
