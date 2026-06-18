import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import {
	BillingInterval,
	type ColumnKind,
	CreditTransactionType,
	DataSourceStatus,
	DataSourceType,
	enumToPgEnum,
	InvitationStatus,
	LeadSource,
	LeadStatus,
	MemberRole,
	OrderStatus,
	PriceModel,
	PriceType,
	QueryRunStatus,
	SubscriptionStatus,
	UserRole,
} from "./enums";

export const accountTable = pgTable(
	"account",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		password: text("password"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("account_user_id_idx").on(table.userId),
		uniqueIndex("account_provider_account_idx").on(
			table.providerId,
			table.accountId,
		),
	],
);

export const invitationTable = pgTable(
	"invitation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role", { enum: enumToPgEnum(MemberRole) })
			.$type<MemberRole>()
			.notNull()
			.default(MemberRole.member),
		status: text("status", { enum: enumToPgEnum(InvitationStatus) })
			.$type<InvitationStatus>()
			.notNull()
			.default(InvitationStatus.pending),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		inviterId: uuid("inviter_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("invitation_organization_id_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
		index("invitation_status_idx").on(table.status),
		index("invitation_expires_at_idx").on(table.expiresAt),
		index("invitation_inviter_id_idx").on(table.inviterId),
	],
);

export const memberTable = pgTable(
	"member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: text("role", { enum: enumToPgEnum(MemberRole) })
			.$type<MemberRole>()
			.notNull()
			.default(MemberRole.member),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("member_user_org_idx").on(table.userId, table.organizationId),
		index("member_organization_id_idx").on(table.organizationId),
		index("member_user_id_idx").on(table.userId),
		index("member_role_idx").on(table.role),
	],
);

export const organizationTable = pgTable(
	"organization",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug"),
		logo: text("logo"),
		metadata: text("metadata"),
		stripeCustomerId: text("stripe_customer_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("organization_slug_idx").on(table.slug),
		index("organization_name_idx").on(table.name),
		index("organization_stripe_customer_id_idx").on(table.stripeCustomerId),
	],
);

export const sessionTable = pgTable(
	"session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		impersonatedBy: uuid("impersonated_by").references(() => userTable.id),
		activeOrganizationId: uuid("active_organization_id"),
		token: text("token").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("session_token_idx").on(table.token),
		index("session_user_id_idx").on(table.userId),
		index("session_expires_at_idx").on(table.expiresAt),
		index("session_active_organization_id_idx").on(table.activeOrganizationId),
	],
);

export const twoFactorTable = pgTable(
	"two_factor",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("two_factor_user_id_idx").on(table.userId)],
);

export const userTable = pgTable(
	"user",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		username: text("username").unique(),
		role: text("role", { enum: enumToPgEnum(UserRole) })
			.$type<UserRole>()
			.notNull()
			.default(UserRole.user),
		banned: boolean("banned").default(false),
		banReason: text("ban_reason"),
		banExpires: timestamp("ban_expires", { withTimezone: true }),
		onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
		twoFactorEnabled: boolean("two_factor_enabled").default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("user_email_idx").on(table.email),
		uniqueIndex("user_username_idx").on(table.username),
		index("user_role_idx").on(table.role),
		index("user_banned_idx").on(table.banned),
	],
);

export const verificationTable = pgTable(
	"verification",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("verification_identifier_idx").on(table.identifier),
		index("verification_value_idx").on(table.value),
		index("verification_expires_at_idx").on(table.expiresAt),
	],
);

// ============================================================================
// BILLING TABLES
// ============================================================================

/**
 * Subscription table - stores active subscriptions from Stripe
 * This is a more detailed approach than a simple "order" table,
 * allowing for proper subscription lifecycle management.
 */
export const subscriptionTable = pgTable(
	"subscription",
	{
		id: text("id").primaryKey(), // Stripe subscription ID (sub_xxx)
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull(),
		status: text("status", { enum: enumToPgEnum(SubscriptionStatus) })
			.$type<SubscriptionStatus>()
			.notNull(),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity (for per-seat billing)
		quantity: integer("quantity").notNull().default(1),
		// Billing interval
		interval: text("interval", { enum: enumToPgEnum(BillingInterval) })
			.$type<BillingInterval>()
			.notNull(),
		intervalCount: integer("interval_count").notNull().default(1),
		// Pricing
		unitAmount: integer("unit_amount"), // Amount in cents
		currency: text("currency").notNull().default("usd"),
		// Period dates
		currentPeriodStart: timestamp("current_period_start", {
			withTimezone: true,
		}).notNull(),
		currentPeriodEnd: timestamp("current_period_end", {
			withTimezone: true,
		}).notNull(),
		// Trial dates
		trialStart: timestamp("trial_start", { withTimezone: true }),
		trialEnd: timestamp("trial_end", { withTimezone: true }),
		// Cancellation
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		canceledAt: timestamp("canceled_at", { withTimezone: true }),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("subscription_organization_id_idx").on(table.organizationId),
		index("subscription_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("subscription_status_idx").on(table.status),
		index("subscription_stripe_price_id_idx").on(table.stripePriceId),
		// Composite index for common query: active subscriptions by organization
		index("subscription_org_status_idx").on(table.organizationId, table.status),
	],
);

/**
 * Subscription item table - stores individual line items for a subscription
 * Supports per-seat pricing, metered billing, and multiple prices per subscription
 */
export const subscriptionItemTable = pgTable(
	"subscription_item",
	{
		id: text("id").primaryKey(), // Stripe subscription item ID (si_xxx)
		subscriptionId: text("subscription_id")
			.notNull()
			.references(() => subscriptionTable.id, { onDelete: "cascade" }),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity (for per-seat billing)
		quantity: integer("quantity").notNull().default(1),
		// Price details
		priceAmount: integer("price_amount"), // Amount in cents per unit
		// Pricing model
		priceType: text("price_type", { enum: enumToPgEnum(PriceType) })
			.$type<PriceType>()
			.notNull()
			.default(PriceType.recurring),
		priceModel: text("price_model", { enum: enumToPgEnum(PriceModel) })
			.$type<PriceModel>()
			.notNull()
			.default(PriceModel.flat),
		// Billing interval (for recurring)
		interval: text("interval", {
			enum: enumToPgEnum(BillingInterval),
		}).$type<BillingInterval>(),
		intervalCount: integer("interval_count").default(1),
		// Metered billing
		meterId: text("meter_id"), // Stripe meter ID for usage-based billing
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("subscription_item_subscription_id_idx").on(table.subscriptionId),
		index("subscription_item_stripe_price_id_idx").on(table.stripePriceId),
		index("subscription_item_price_model_idx").on(table.priceModel),
	],
);

/**
 * Order table - stores one-time payments (lifetime deals, credits, etc.)
 * This is the order header; individual items are stored in order_item
 */
export const orderTable = pgTable(
	"order",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull(),
		stripePaymentIntentId: text("stripe_payment_intent_id"), // pi_xxx
		stripeCheckoutSessionId: text("stripe_checkout_session_id"), // cs_xxx
		// Totals (sum of all items)
		totalAmount: integer("total_amount").notNull(), // Total amount in cents
		currency: text("currency").notNull().default("usd"),
		// Status
		status: text("status", { enum: enumToPgEnum(OrderStatus) })
			.$type<OrderStatus>()
			.notNull()
			.default(OrderStatus.completed),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("order_organization_id_idx").on(table.organizationId),
		index("order_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("order_status_idx").on(table.status),
		index("order_payment_intent_id_idx").on(table.stripePaymentIntentId),
		index("order_checkout_session_id_idx").on(table.stripeCheckoutSessionId),
	],
);

/**
 * Order item table - stores individual line items for an order
 * Supports multiple products/prices per order
 */
export const orderItemTable = pgTable(
	"order_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orderTable.id, { onDelete: "cascade" }),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity and pricing
		quantity: integer("quantity").notNull().default(1),
		unitAmount: integer("unit_amount").notNull(), // Price per unit in cents
		totalAmount: integer("total_amount").notNull(), // quantity * unitAmount
		// Description (from Stripe line item)
		description: text("description"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("order_item_order_id_idx").on(table.orderId),
		index("order_item_stripe_price_id_idx").on(table.stripePriceId),
	],
);

/**
 * Billing event log - audit trail for all billing events
 * Useful for debugging and customer support
 */
export const billingEventTable = pgTable(
	"billing_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(
			() => organizationTable.id,
			{ onDelete: "set null" },
		),
		stripeEventId: text("stripe_event_id").notNull().unique(), // evt_xxx
		eventType: text("event_type").notNull(), // e.g., "customer.subscription.created"
		// Reference to related entities
		subscriptionId: text("subscription_id"),
		orderId: uuid("order_id"),
		// Raw event data for debugging
		eventData: text("event_data"), // JSON stringified
		// Processing status
		processed: boolean("processed").notNull().default(true),
		error: text("error"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("billing_event_organization_id_idx").on(table.organizationId),
		index("billing_event_event_type_idx").on(table.eventType),
		index("billing_event_subscription_id_idx").on(table.subscriptionId),
		index("billing_event_created_at_idx").on(table.createdAt),
	],
);

/**
 * Credit balance per organization
 * Denormalized for fast reads - single row per org
 */
export const creditBalanceTable = pgTable(
	"credit_balance",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.unique()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Current balance (can be large for high-volume orgs)
		balance: integer("balance").notNull().default(0),
		// Lifetime stats for analytics
		lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
		lifetimeGranted: integer("lifetime_granted").notNull().default(0), // Free/promo
		lifetimeUsed: integer("lifetime_used").notNull().default(0),
		lifetimeExpired: integer("lifetime_expired").notNull().default(0),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("credit_balance_organization_id_idx").on(table.organizationId),
	],
);

/**
 * Credit deduction failure log - tracks failed deductions for reconciliation
 * When credit deduction fails after AI response is already sent, we log it here
 */
export const creditDeductionFailureTable = pgTable(
	"credit_deduction_failure",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Amount that should have been deducted
		amount: integer("amount").notNull(),
		// Error details
		errorCode: text("error_code").notNull(), // 'INSUFFICIENT_CREDITS', 'DB_ERROR', etc.
		errorMessage: text("error_message"),
		// Context
		model: text("model"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		referenceType: text("reference_type"), // 'ai_chat', etc.
		referenceId: text("reference_id"),
		// Who triggered the request
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Resolution tracking
		resolved: boolean("resolved").notNull().default(false),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedBy: uuid("resolved_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		resolutionNotes: text("resolution_notes"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("credit_deduction_failure_org_idx").on(table.organizationId),
		index("credit_deduction_failure_resolved_idx").on(table.resolved),
		index("credit_deduction_failure_created_idx").on(table.createdAt),
	],
);

/**
 * Credit transaction ledger - immutable audit trail
 * Every credit change is recorded here
 */
export const creditTransactionTable = pgTable(
	"credit_transaction",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Transaction type
		type: text("type", { enum: enumToPgEnum(CreditTransactionType) })
			.$type<CreditTransactionType>()
			.notNull(),
		// Amount: positive = add credits, negative = deduct credits
		amount: integer("amount").notNull(),
		// Running balance after this transaction
		balanceAfter: integer("balance_after").notNull(),
		// Description shown to user
		description: text("description"),
		// Reference to source (order, subscription, chat, etc.)
		referenceType: text("reference_type"), // 'order', 'subscription', 'ai_chat', 'admin', etc.
		referenceId: text("reference_id"),
		// AI usage details (for usage transactions)
		model: text("model"), // 'gpt-4o-mini', 'gpt-4o', etc.
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		// Who initiated this transaction
		createdBy: uuid("created_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Metadata for additional context
		metadata: text("metadata"), // JSON stringified
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("credit_transaction_organization_id_idx").on(table.organizationId),
		index("credit_transaction_type_idx").on(table.type),
		index("credit_transaction_created_at_idx").on(table.createdAt),
		index("credit_transaction_reference_idx").on(
			table.referenceType,
			table.referenceId,
		),
		// Composite for org history queries
		index("credit_transaction_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		// Composite index for org+type filtering
		index("credit_transaction_org_type_idx").on(
			table.organizationId,
			table.type,
		),
		// Unique constraint for checkout session idempotency (partial index)
		// This prevents double-crediting from webhook retries
		uniqueIndex("credit_transaction_checkout_unique")
			.on(table.referenceType, table.referenceId)
			.where(sql`${table.referenceType} = 'checkout_session'`),
		// Unique constraint for bonus credits idempotency (partial index)
		// This prevents double bonus credits from webhook retries
		uniqueIndex("credit_transaction_bonus_unique")
			.on(table.referenceType, table.referenceId)
			.where(sql`${table.referenceType} = 'checkout_session_bonus'`),
	],
);

// ============================================================================
// AI CHAT TABLE
// ============================================================================

/**
 * AI Chat table - stores chat conversations with AI
 * Supports both user-level and organization-level chats
 * Note: At least one of organizationId or userId must be non-null (enforced by check constraint)
 */
export const aiChatTable = pgTable(
	"ai_chat",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(
			() => organizationTable.id,
			{ onDelete: "cascade" },
		),
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "cascade",
		}),
		title: text("title"),
		messages: text("messages"), // JSON stringified array of messages
		pinned: boolean("pinned").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ai_chat_organization_id_idx").on(table.organizationId),
		index("ai_chat_user_id_idx").on(table.userId),
		index("ai_chat_created_at_idx").on(table.createdAt),
		// Ensure at least one owner is set - prevent orphaned chats
		check(
			"ai_chat_has_owner",
			sql`${table.organizationId} IS NOT NULL OR ${table.userId} IS NOT NULL`,
		),
	],
);

// ============================================================================
// LEADS TABLE
// ============================================================================

/**
 * Lead table - stores leads/prospects for an organization
 */
export const leadTable = pgTable(
	"lead",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Contact information
		firstName: text("first_name").notNull(),
		lastName: text("last_name").notNull(),
		email: text("email").notNull(),
		phone: text("phone"),
		company: text("company"),
		jobTitle: text("job_title"),
		// Lead details
		status: text("status", { enum: enumToPgEnum(LeadStatus) })
			.$type<LeadStatus>()
			.notNull()
			.default(LeadStatus.new),
		source: text("source", { enum: enumToPgEnum(LeadSource) })
			.$type<LeadSource>()
			.notNull()
			.default(LeadSource.other),
		// Value and notes
		estimatedValue: integer("estimated_value"), // Amount in cents
		notes: text("notes"),
		// Assigned to
		assignedToId: uuid("assigned_to_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("lead_organization_id_idx").on(table.organizationId),
		index("lead_status_idx").on(table.status),
		index("lead_source_idx").on(table.source),
		index("lead_assigned_to_id_idx").on(table.assignedToId),
		index("lead_email_idx").on(table.email),
		index("lead_created_at_idx").on(table.createdAt),
		// Composite index for common query: leads by organization and status
		index("lead_org_status_idx").on(table.organizationId, table.status),
	],
);

// ============================================================================
// AskBI TABLES (conversational BI feature)
// ============================================================================

/**
 * Data source - a connected analytical database (or, later, file) per org.
 *
 * Secrets (e.g. the password) live in `encryptedCredentials` as an AES-256-GCM
 * envelope and are never returned to the client. Non-secret connection details
 * (host, port, database, user, ssl) live in `config` as plaintext JSON so the
 * UI can display and reconnect without decrypting.
 */
export const dataSourceTable = pgTable(
	"data_source",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type", { enum: enumToPgEnum(DataSourceType) })
			.$type<DataSourceType>()
			.notNull(),
		status: text("status", { enum: enumToPgEnum(DataSourceStatus) })
			.$type<DataSourceStatus>()
			.notNull()
			.default(DataSourceStatus.pending),
		// Plaintext JSON of non-secret connection details (no password)
		config: text("config"),
		// AES-256-GCM envelope of the secret connection blob (server-only)
		encryptedCredentials: text("encrypted_credentials"),
		// Last connection test / introspection diagnostics
		lastError: text("last_error"),
		lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
		lastIntrospectedAt: timestamp("last_introspected_at", {
			withTimezone: true,
		}),
		createdBy: uuid("created_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("data_source_organization_id_idx").on(table.organizationId),
		index("data_source_type_idx").on(table.type),
		index("data_source_status_idx").on(table.status),
		index("data_source_org_status_idx").on(table.organizationId, table.status),
	],
);

/**
 * Catalog table - one introspected table/view from a data source. Forms the
 * per-org "grounding" the agent retrieves from; the model never invents schema.
 */
export const catalogTableTable = pgTable(
	"catalog_table",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		dataSourceId: uuid("data_source_id")
			.notNull()
			.references(() => dataSourceTable.id, { onDelete: "cascade" }),
		// Denormalized for fast org-scoped catalog retrieval / RLS-style filtering
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		schemaName: text("schema_name").notNull().default("public"),
		tableName: text("table_name").notNull(),
		// Optional friendly description / synonyms seed (editable semantic layer)
		description: text("description"),
		rowCountEstimate: integer("row_count_estimate"),
		// JSON array of { column, referencesSchema, referencesTable, referencesColumn }
		foreignKeys: text("foreign_keys"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("catalog_table_data_source_id_idx").on(table.dataSourceId),
		index("catalog_table_organization_id_idx").on(table.organizationId),
		uniqueIndex("catalog_table_unique_idx").on(
			table.dataSourceId,
			table.schemaName,
			table.tableName,
		),
	],
);

/**
 * Catalog column - one column of a catalog table, with cheap stats used for
 * grounding and chart selection.
 */
export const catalogColumnTable = pgTable(
	"catalog_column",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		catalogTableId: uuid("catalog_table_id")
			.notNull()
			.references(() => catalogTableTable.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		columnName: text("column_name").notNull(),
		// Raw engine type (e.g. "integer", "character varying")
		dataType: text("data_type").notNull(),
		// Normalized kind for chart selection (number/string/date/...)
		normalizedType: text("normalized_type").$type<ColumnKind>().notNull(),
		isNullable: boolean("is_nullable").notNull().default(true),
		isPrimaryKey: boolean("is_primary_key").notNull().default(false),
		ordinalPosition: integer("ordinal_position"),
		// Editable semantic-layer fields
		description: text("description"),
		synonyms: text("synonyms"), // JSON array of strings
		// Cheap stats (populated for low-cardinality columns)
		distinctCount: integer("distinct_count"),
		sampleValues: text("sample_values"), // JSON array
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("catalog_column_catalog_table_id_idx").on(table.catalogTableId),
		index("catalog_column_organization_id_idx").on(table.organizationId),
		uniqueIndex("catalog_column_unique_idx").on(
			table.catalogTableId,
			table.columnName,
		),
	],
);

/**
 * Query run - the audit log AND the persisted execution record. Every NL→SQL
 * attempt writes a row here: the generated SQL, source, user, outcome, row
 * count, latency, and credits consumed. Chat messages reference a run by id
 * rather than embedding result sets.
 */
export const queryRunTable = pgTable(
	"query_run",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Keep the audit row even if the source/chat is later deleted
		dataSourceId: uuid("data_source_id").references(() => dataSourceTable.id, {
			onDelete: "set null",
		}),
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		chatId: uuid("chat_id").references(() => aiChatTable.id, {
			onDelete: "set null",
		}),
		// The natural-language question that produced this SQL
		question: text("question"),
		generatedSql: text("generated_sql").notNull(),
		status: text("status", { enum: enumToPgEnum(QueryRunStatus) })
			.$type<QueryRunStatus>()
			.notNull(),
		rowCount: integer("row_count"),
		durationMs: integer("duration_ms"),
		truncated: boolean("truncated").notNull().default(false),
		// Execution error (status=error) or validator rejection (status=blocked)
		error: text("error"),
		creditsConsumed: integer("credits_consumed"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("query_run_organization_id_idx").on(table.organizationId),
		index("query_run_data_source_id_idx").on(table.dataSourceId),
		index("query_run_user_id_idx").on(table.userId),
		index("query_run_chat_id_idx").on(table.chatId),
		index("query_run_status_idx").on(table.status),
		index("query_run_created_at_idx").on(table.createdAt),
		index("query_run_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

/**
 * Saved query - a question/SQL/visualization the user pinned to revisit.
 */
export const savedQueryTable = pgTable(
	"saved_query",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		dataSourceId: uuid("data_source_id").references(() => dataSourceTable.id, {
			onDelete: "set null",
		}),
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		question: text("question"),
		sql: text("sql").notNull(),
		// JSON declarative visualization spec
		vizSpec: text("viz_spec"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("saved_query_organization_id_idx").on(table.organizationId),
		index("saved_query_data_source_id_idx").on(table.dataSourceId),
		index("saved_query_user_id_idx").on(table.userId),
		index("saved_query_created_at_idx").on(table.createdAt),
	],
);
