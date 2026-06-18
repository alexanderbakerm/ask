import { z } from "zod/v4";

// ============================================================================
// CURRENCY VALIDATION
// ============================================================================

/**
 * Common ISO 4217 currency codes supported by Stripe.
 * This is a subset of all ISO 4217 codes - add more as needed.
 * Full list: https://stripe.com/docs/currencies
 */
export const SUPPORTED_CURRENCIES = [
	"usd", // US Dollar
	"eur", // Euro
	"gbp", // British Pound
	"jpy", // Japanese Yen
	"cad", // Canadian Dollar
	"aud", // Australian Dollar
	"chf", // Swiss Franc
	"cny", // Chinese Yuan
	"inr", // Indian Rupee
	"mxn", // Mexican Peso
	"brl", // Brazilian Real
	"krw", // South Korean Won
	"sgd", // Singapore Dollar
	"hkd", // Hong Kong Dollar
	"nzd", // New Zealand Dollar
	"sek", // Swedish Krona
	"nok", // Norwegian Krone
	"dkk", // Danish Krone
	"pln", // Polish Zloty
	"zar", // South African Rand
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Currency schema that validates against supported currencies.
 * Accepts both lowercase and uppercase codes, normalizes to lowercase.
 */
export const CurrencySchema = z
	.string()
	.length(3)
	.transform((val) => val.toLowerCase())
	.refine(
		(val): val is SupportedCurrency =>
			SUPPORTED_CURRENCIES.includes(val as SupportedCurrency),
		{
			message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
		},
	);

// ============================================================================
// PRICE SCHEMAS
// ============================================================================

export const PriceIntervalSchema = z.enum(["month", "year", "week", "day"]);
export type PriceInterval = z.infer<typeof PriceIntervalSchema>;

export const PriceTypeSchema = z.enum(["recurring", "one_time"]);
export type PriceType = z.infer<typeof PriceTypeSchema>;

export const PriceModelSchema = z.enum(["flat", "per_seat", "metered"]);
export type PriceModel = z.infer<typeof PriceModelSchema>;

// Metered price tier schema
const TierSchema = z.object({
	upTo: z.number().min(0),
	cost: z.number().min(0),
});

// Meter configuration for usage-based billing
const MeterSchema = z.object({
	id: z.string().optional(), // Stripe meter ID
	eventName: z.string().min(1), // Event name for reporting usage
	unit: z.string().min(1), // e.g., "API calls", "tokens"
	tiers: z.array(TierSchema).optional(),
});

// Base price schema
const BasePriceSchema = z.object({
	id: z.string().min(1),
	stripePriceId: z.string().min(1),
	amount: z.number().min(0),
	currency: CurrencySchema,
});

// Recurring price schema
const RecurringPriceSchema = BasePriceSchema.extend({
	type: z.literal("recurring"),
	interval: PriceIntervalSchema,
	intervalCount: z.number().min(1).default(1),
	model: PriceModelSchema.default("flat"),
	seatBased: z.boolean().optional(),
	trialDays: z.number().min(0).optional(),
	meter: MeterSchema.optional(),
});

// One-time price schema
const OneTimePriceSchema = BasePriceSchema.extend({
	type: z.literal("one_time"),
	model: z.literal("flat").default("flat"), // One-time can only be flat
});

// Combined price schema with refinements
export const PriceSchema = z
	.discriminatedUnion("type", [RecurringPriceSchema, OneTimePriceSchema])
	.refine(
		(data) => {
			// Metered prices must have a meter configuration
			if (data.type === "recurring" && data.model === "metered") {
				return data.meter !== undefined;
			}
			return true;
		},
		{
			message: "Metered prices must have a meter configuration",
			path: ["meter"],
		},
	)
	.refine(
		(data) => {
			// Metered prices should have 0 base amount (charged by usage)
			if (
				data.type === "recurring" &&
				data.model === "metered" &&
				data.amount !== 0
			) {
				return false;
			}
			return true;
		},
		{
			message:
				"Metered prices should have amount of 0 (pricing is usage-based)",
			path: ["amount"],
		},
	);

export type Price = z.infer<typeof PriceSchema>;

// ============================================================================
// PLAN SCHEMAS
// ============================================================================

const PlanLimitsSchema = z.object({
	maxMembers: z.number(), // -1 for unlimited
	maxStorage: z.number(), // in GB, -1 for unlimited
});

export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

const BasePlanSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().min(1),
	features: z.array(z.string()),
	limits: PlanLimitsSchema.optional(),
});

// Free plan schema
const FreePlanSchema = BasePlanSchema.extend({
	isFree: z.literal(true),
	prices: z.undefined().optional(),
	recommended: z.undefined().optional(),
	isEnterprise: z.undefined().optional(),
});

// Paid plan schema
const PaidPlanSchema = BasePlanSchema.extend({
	isFree: z.undefined().optional(),
	prices: z.array(PriceSchema).min(1),
	recommended: z.boolean().optional(),
	isEnterprise: z.undefined().optional(),
});

// Enterprise plan schema (contact sales, no prices)
const EnterprisePlanSchema = BasePlanSchema.extend({
	isFree: z.undefined().optional(),
	prices: z.undefined().optional(),
	recommended: z.undefined().optional(),
	isEnterprise: z.literal(true),
});

export const PlanSchema = z.union([
	FreePlanSchema,
	PaidPlanSchema,
	EnterprisePlanSchema,
]);

export type Plan = z.infer<typeof PlanSchema>;

// ============================================================================
// BILLING CONFIG SCHEMA
// ============================================================================

export const BillingConfigSchema = z
	.object({
		enabled: z.boolean(),
		defaultCurrency: CurrencySchema,
		plans: z.record(z.string(), PlanSchema),
	})
	.refine(
		(data) => {
			// Ensure all plan IDs match their keys
			for (const [key, plan] of Object.entries(data.plans)) {
				if (plan.id !== key) {
					return false;
				}
			}
			return true;
		},
		{
			message: "Plan ID must match its key in the plans object",
			path: ["plans"],
		},
	)
	.refine(
		(data) => {
			// Ensure all price IDs are unique across all plans
			const priceIds = new Set<string>();
			for (const plan of Object.values(data.plans)) {
				if ("prices" in plan && plan.prices) {
					for (const price of plan.prices) {
						if (priceIds.has(price.id)) {
							return false;
						}
						priceIds.add(price.id);
					}
				}
			}
			return true;
		},
		{
			message: "Price IDs must be unique across all plans",
			path: ["plans"],
		},
	)
	.refine(
		(data) => {
			// Ensure all stripePriceIds are unique
			const stripePriceIds = new Set<string>();
			for (const plan of Object.values(data.plans)) {
				if ("prices" in plan && plan.prices) {
					for (const price of plan.prices) {
						if (stripePriceIds.has(price.stripePriceId)) {
							return false;
						}
						stripePriceIds.add(price.stripePriceId);
					}
				}
			}
			return true;
		},
		{
			message: "Stripe price IDs must be unique across all plans",
			path: ["plans"],
		},
	)
	.refine(
		(data) => {
			// Ensure all price currencies match the default currency
			// This prevents currency mismatch issues during checkout
			const defaultCurrency = data.defaultCurrency.toLowerCase();
			for (const plan of Object.values(data.plans)) {
				if ("prices" in plan && plan.prices) {
					for (const price of plan.prices) {
						if (price.currency.toLowerCase() !== defaultCurrency) {
							return false;
						}
					}
				}
			}
			return true;
		},
		{
			message:
				"All price currencies must match the defaultCurrency. Multi-currency is not yet supported.",
			path: ["plans"],
		},
	);

export type BillingConfig = z.infer<typeof BillingConfigSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a billing configuration at runtime.
 * Throws a ZodError if validation fails.
 */
export function validateBillingConfig(config: unknown): BillingConfig {
	return BillingConfigSchema.parse(config);
}

/**
 * Safely validate a billing configuration.
 * Returns a result object instead of throwing.
 */
export function safeParseBillingConfig(config: unknown): {
	success: boolean;
	data?: BillingConfig;
	error?: z.ZodError;
} {
	const result = BillingConfigSchema.safeParse(config);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}
