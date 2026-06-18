// Invitation status enum (matches Better Auth)
export const InvitationStatus = {
	pending: "pending",
	accepted: "accepted",
	rejected: "rejected",
	canceled: "canceled",
} as const;
export type InvitationStatus =
	(typeof InvitationStatus)[keyof typeof InvitationStatus];
export const InvitationStatuses = Object.values(InvitationStatus);

// Member role enum
export const MemberRole = {
	owner: "owner",
	admin: "admin",
	member: "member",
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export const MemberRoles = Object.values(MemberRole);

// User role enum
export const UserRole = {
	user: "user",
	admin: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const UserRoles = Object.values(UserRole);

// Order type enum (for billing)
export const OrderType = {
	subscription: "subscription",
	oneTime: "one_time",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];
export const OrderTypes = Object.values(OrderType);

// Subscription status enum (matches Stripe subscription statuses)
export const SubscriptionStatus = {
	active: "active",
	canceled: "canceled",
	incomplete: "incomplete",
	incompleteExpired: "incomplete_expired",
	pastDue: "past_due",
	paused: "paused",
	trialing: "trialing",
	unpaid: "unpaid",
} as const;
export type SubscriptionStatus =
	(typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const SubscriptionStatuses = Object.values(SubscriptionStatus);

// Billing interval enum
export const BillingInterval = {
	month: "month",
	year: "year",
	week: "week",
	day: "day",
} as const;
export type BillingInterval =
	(typeof BillingInterval)[keyof typeof BillingInterval];
export const BillingIntervals = Object.values(BillingInterval);

// Price type enum (recurring vs one-time)
export const PriceType = {
	recurring: "recurring",
	oneTime: "one_time",
} as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];
export const PriceTypes = Object.values(PriceType);

// Price model enum (flat, per-seat, metered)
export const PriceModel = {
	flat: "flat",
	perSeat: "per_seat",
	metered: "metered",
} as const;
export type PriceModel = (typeof PriceModel)[keyof typeof PriceModel];
export const PriceModels = Object.values(PriceModel);

// Order status enum (for one-time payments)
export const OrderStatus = {
	pending: "pending",
	completed: "completed",
	failed: "failed",
	refunded: "refunded",
	partiallyRefunded: "partially_refunded",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const OrderStatuses = Object.values(OrderStatus);

// Lead status enum
export const LeadStatus = {
	new: "new",
	contacted: "contacted",
	qualified: "qualified",
	proposal: "proposal",
	negotiation: "negotiation",
	won: "won",
	lost: "lost",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];
export const LeadStatuses = Object.values(LeadStatus);

// Lead source enum
export const LeadSource = {
	website: "website",
	referral: "referral",
	socialMedia: "social_media",
	advertising: "advertising",
	coldCall: "cold_call",
	email: "email",
	event: "event",
	other: "other",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];
export const LeadSources = Object.values(LeadSource);

// Credit transaction type enum
export const CreditTransactionType = {
	purchase: "purchase", // User bought credits
	subscriptionGrant: "subscription_grant", // Monthly subscription allocation
	bonus: "bonus", // Bonus from package purchase
	promo: "promo", // Promotional credits (coupon, referral)
	usage: "usage", // Credits consumed by AI
	refund: "refund", // Credits refunded
	expire: "expire", // Credits expired
	adjustment: "adjustment", // Manual admin adjustment
} as const;
export type CreditTransactionType =
	(typeof CreditTransactionType)[keyof typeof CreditTransactionType];
export const CreditTransactionTypes = Object.values(CreditTransactionType);

// ============================================================================
// AskBI ENUMS (conversational BI feature)
// ============================================================================

// Data source connector type
export const DataSourceType = {
	postgres: "postgres",
	mysql: "mysql",
	csv: "csv",
	excel: "excel",
} as const;
export type DataSourceType =
	(typeof DataSourceType)[keyof typeof DataSourceType];
export const DataSourceTypes = Object.values(DataSourceType);

// Data source connection lifecycle status
export const DataSourceStatus = {
	pending: "pending", // created but not yet successfully tested
	connected: "connected", // last test/introspection succeeded
	error: "error", // last test/introspection failed
} as const;
export type DataSourceStatus =
	(typeof DataSourceStatus)[keyof typeof DataSourceStatus];
export const DataSourceStatuses = Object.values(DataSourceStatus);

// Outcome of an attempt to generate + run a query (every attempt is audited,
// not just the happy path).
export const QueryRunStatus = {
	success: "success", // validated and executed
	validationRejected: "validation_rejected", // SELECT-only or catalog check rejected it
	executionError: "execution_error", // the database rejected/failed the query
	timeout: "timeout", // exceeded the statement timeout
} as const;
export type QueryRunStatus =
	(typeof QueryRunStatus)[keyof typeof QueryRunStatus];
export const QueryRunStatuses = Object.values(QueryRunStatus);

/**
 * Normalized column kind, derived during introspection from the engine's raw
 * type. Drives downstream (deterministic) chart selection. Stored as text so
 * it can grow without a DB enum migration.
 */
export const ColumnKind = {
	number: "number",
	string: "string",
	boolean: "boolean",
	date: "date",
	datetime: "datetime",
	time: "time",
	json: "json",
	unknown: "unknown",
} as const;
export type ColumnKind = (typeof ColumnKind)[keyof typeof ColumnKind];
export const ColumnKinds = Object.values(ColumnKind);

export function enumToPgEnum<T extends Record<string, string>>(myEnum: T) {
	return Object.values(myEnum).map((value) => value) as [
		T[keyof T],
		...T[keyof T][],
	];
}
