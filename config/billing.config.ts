import { env } from "@/lib/env";

export const billingConfig = {
	// Enable/disable billing feature
	enabled: true,
	// Default currency
	defaultCurrency: "usd",
	// Plans configuration
	// Each plan has a unique ID and can have multiple prices (monthly/yearly)
	// The price IDs come from Stripe Dashboard > Products > Prices
	plans: {
		// Free tier - no Stripe price needed
		free: {
			id: "free",
			name: "Free",
			description: "Get started with basic features",
			isFree: true,
			features: [
				"Up to 3 team members",
				"Basic analytics",
				"Community support",
				"1 GB storage",
			],
			limits: {
				maxMembers: 3,
				maxStorage: 1, // GB
			},
		},
		// Pro plan - main paid tier
		pro: {
			id: "pro",
			name: "Pro",
			description: "For growing teams",
			recommended: true,
			features: [
				"Unlimited team members",
				"Advanced analytics",
				"Priority support",
				"100 GB storage",
				"Custom integrations",
				"API access",
			],
			limits: {
				maxMembers: -1, // unlimited
				maxStorage: 100, // GB
			},
			prices: [
				{
					id: "pro_monthly",
					stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "",
					type: "recurring",
					interval: "month",
					intervalCount: 1,
					amount: 2900, // $29.00 in cents
					currency: "usd",
					// Per-seat pricing: charge per team member
					seatBased: true,
					// Trial period
					trialDays: 14,
				},
				{
					id: "pro_yearly",
					stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY ?? "",
					type: "recurring",
					interval: "year",
					intervalCount: 1,
					amount: 27800, // $278.00 in cents (~20% savings)
					currency: "usd",
					seatBased: true,
					trialDays: 14,
				},
			],
		},
		// Enterprise plan - contact sales
		// enterprise: {
		// 	id: "enterprise",
		// 	name: "Enterprise",
		// 	description: "For large organizations with custom needs",
		// 	isEnterprise: true,
		// 	features: [
		// 		"Everything in Pro",
		// 		"Dedicated account manager",
		// 		"Custom SLA",
		// 		"Unlimited storage",
		// 		"SSO / SAML",
		// 		"Audit logs",
		// 		"Custom contracts",
		// 	],
		// 	limits: {
		// 		maxMembers: -1,
		// 		maxStorage: -1,
		// 	},
		// },
		// Lifetime deal - one-time order
		lifetime: {
			id: "lifetime",
			name: "Lifetime",
			description: "Pay once, use forever",
			features: [
				"All Pro features",
				"Lifetime updates",
				"Priority support for 1 year",
				"100 GB storage",
			],
			limits: {
				maxMembers: -1,
				maxStorage: 100,
			},
			prices: [
				{
					id: "lifetime_once",
					stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME ?? "",
					type: "one_time",
					amount: 49900, // $499.00 in cents
					currency: "usd",
				},
			],
		},
	},
} satisfies BillingConfig;

// ============================================================================
// CREDIT PACKAGES CONFIGURATION
// ============================================================================

/**
 * Credit packages available for purchase
 * Credits are used for AI features like chat, document analysis, etc.
 */
export const creditPackages = [
	{
		id: "credits_starter",
		name: "Starter",
		description: "Great for trying out AI features",
		credits: 10_000,
		bonusCredits: 0,
		priceAmount: 999, // $9.99 in cents
		currency: "usd",
		stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER ?? "",
		popular: false,
	},
	{
		id: "credits_basic",
		name: "Basic",
		description: "For regular AI usage",
		credits: 50_000,
		bonusCredits: 5_000, // 10% bonus
		priceAmount: 3999, // $39.99
		currency: "usd",
		stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC ?? "",
		popular: true,
	},
	{
		id: "credits_pro",
		name: "Pro",
		description: "Best value for power users",
		credits: 200_000,
		bonusCredits: 40_000, // 20% bonus
		priceAmount: 14999, // $149.99
		currency: "usd",
		stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO ?? "",
		popular: false,
	},
] as const;

export type CreditPackage = (typeof creditPackages)[number];

/**
 * Credit costs per model (credits per 1K tokens)
 *
 * PRICING METHODOLOGY:
 * - 1 credit ≈ $0.001 (1/10th of a cent) for easy mental math
 * - Prices include ~5-10x markup over raw API costs for margin
 * - This allows us to offer competitive pricing while covering:
 *   - API costs
 *   - Infrastructure overhead
 *   - Support costs
 *   - Margin for sustainability
 *
 * EXAMPLE CALCULATION (GPT-4o-mini):
 * - OpenAI pricing: $0.15/1M input = $0.00015/1K input tokens
 * - Our pricing: 1 credit/1K = $0.001/1K (6.6x markup)
 * - OpenAI pricing: $0.60/1M output = $0.0006/1K output tokens
 * - Our pricing: 4 credits/1K = $0.004/1K (6.6x markup)
 *
 * Typical chat costs (per message):
 * - Budget tier (mini/flash): ~3-15 credits (~$0.003-0.015)
 * - Standard tier (4o/sonnet): ~50-200 credits (~$0.05-0.20)
 * - Premium tier (opus/pro): ~200-800 credits (~$0.20-0.80)
 *
 * Adjust these values based on:
 * 1. Changes in API pricing from providers
 * 2. Desired profit margins
 * 3. Competitive analysis
 *
 * Last updated: December 2025
 */
export const creditCosts = {
	// =========================================================================
	// OPENAI MODELS
	// =========================================================================

	// GPT-4o Mini - Budget tier
	"gpt-4o-mini": {
		input: 1, // ~$0.001/1K (OpenAI: $0.15/1M)
		output: 6, // ~$0.006/1K (OpenAI: $0.60/1M)
	},

	// GPT-4o - Standard tier
	"gpt-4o": {
		input: 25, // ~$0.025/1K (OpenAI: $2.50/1M)
		output: 100, // ~$0.10/1K (OpenAI: $10/1M)
	},

	// GPT-4 Turbo - Legacy premium
	"gpt-4-turbo": {
		input: 100, // ~$0.10/1K (OpenAI: $10/1M)
		output: 300, // ~$0.30/1K (OpenAI: $30/1M)
	},

	// GPT-4.1 Models (Released 2025)
	"gpt-4.1": {
		input: 20, // ~$0.02/1K (OpenAI: $2/1M)
		output: 80, // ~$0.08/1K (OpenAI: $8/1M)
	},
	"gpt-4.1-mini": {
		input: 4, // ~$0.004/1K (OpenAI: $0.40/1M)
		output: 16, // ~$0.016/1K (OpenAI: $1.60/1M)
	},
	"gpt-4.1-nano": {
		input: 1, // ~$0.001/1K (OpenAI: $0.10/1M)
		output: 4, // ~$0.004/1K (OpenAI: $0.40/1M)
	},

	// GPT-5 family (2026) — ~10x markup over verified OpenAI list pricing
	"gpt-5.5": {
		input: 50, // OpenAI: $5/1M
		output: 300, // OpenAI: $30/1M
	},
	"gpt-5.4": {
		input: 25, // OpenAI: $2.50/1M
		output: 150, // OpenAI: $15/1M
	},
	"gpt-5.4-mini": {
		input: 8, // OpenAI: $0.75/1M
		output: 45, // OpenAI: $4.50/1M
	},
	"gpt-5.4-nano": {
		input: 2, // OpenAI: $0.20/1M
		output: 13, // OpenAI: $1.25/1M
	},

	// o1 Reasoning Models
	o1: {
		input: 150, // ~$0.15/1K (OpenAI: $15/1M)
		output: 600, // ~$0.60/1K (OpenAI: $60/1M)
	},
	"o1-mini": {
		input: 30, // ~$0.03/1K (OpenAI: $3/1M)
		output: 120, // ~$0.12/1K (OpenAI: $12/1M)
	},
	"o1-pro": {
		input: 1500, // ~$1.50/1K (OpenAI: $150/1M - premium reasoning)
		output: 6000, // ~$6.00/1K (OpenAI: $600/1M)
	},

	// o3 Reasoning Models (Released April 2025)
	o3: {
		input: 20, // ~$0.02/1K (OpenAI: $2/1M after 80% price cut)
		output: 80, // ~$0.08/1K (OpenAI: $8/1M)
	},
	"o3-mini": {
		input: 11, // ~$0.011/1K (OpenAI: $1.10/1M)
		output: 44, // ~$0.044/1K (OpenAI: $4.40/1M)
	},
	"o3-pro": {
		input: 200, // ~$0.20/1K (OpenAI: $20/1M)
		output: 800, // ~$0.80/1K (OpenAI: $80/1M)
	},

	// o4 Reasoning Models (Released April 2025)
	"o4-mini": {
		input: 11, // ~$0.011/1K (OpenAI: $1.10/1M)
		output: 44, // ~$0.044/1K (OpenAI: $4.40/1M)
	},

	// =========================================================================
	// ANTHROPIC CLAUDE MODELS
	// =========================================================================

	// Claude 3 Haiku - Budget tier (Legacy)
	"claude-3-haiku": {
		input: 2, // ~$0.002/1K (Anthropic: $0.25/1M)
		output: 12, // ~$0.012/1K (Anthropic: $1.25/1M)
	},

	// Claude 3.5 Haiku - Enhanced budget tier
	"claude-3.5-haiku": {
		input: 8, // ~$0.008/1K (Anthropic: $0.80/1M)
		output: 40, // ~$0.04/1K (Anthropic: $4/1M)
	},

	// Claude 3 Sonnet - Standard tier (Legacy)
	"claude-3-sonnet": {
		input: 30, // ~$0.03/1K (Anthropic: $3/1M)
		output: 150, // ~$0.15/1K (Anthropic: $15/1M)
	},

	// Claude 3.5 Sonnet - Enhanced standard
	"claude-3.5-sonnet": {
		input: 30, // ~$0.03/1K (Anthropic: $3/1M)
		output: 150, // ~$0.15/1K (Anthropic: $15/1M)
	},

	// Claude 3.7 Sonnet
	"claude-3.7-sonnet": {
		input: 30, // ~$0.03/1K (Anthropic: $3/1M)
		output: 150, // ~$0.15/1K (Anthropic: $15/1M)
	},

	// Claude 3 Opus - Premium tier
	"claude-3-opus": {
		input: 150, // ~$0.15/1K (Anthropic: $15/1M)
		output: 750, // ~$0.75/1K (Anthropic: $75/1M)
	},

	// Claude 4 Models (Released May 2025)
	"claude-sonnet-4": {
		input: 30, // ~$0.03/1K (Anthropic: $3/1M)
		output: 150, // ~$0.15/1K (Anthropic: $15/1M)
	},
	"claude-opus-4": {
		input: 150, // ~$0.15/1K (Anthropic: $15/1M)
		output: 750, // ~$0.75/1K (Anthropic: $75/1M)
	},

	// Claude 4.1 Models
	"claude-opus-4.1": {
		input: 150, // ~$0.15/1K (Anthropic: $15/1M)
		output: 750, // ~$0.75/1K (Anthropic: $75/1M)
	},

	// Claude 4.5 Models (Released September 2025)
	"claude-sonnet-4.5": {
		input: 30, // ~$0.03/1K (Anthropic: $3/1M)
		output: 150, // ~$0.15/1K (Anthropic: $15/1M)
	},
	"claude-opus-4.5": {
		input: 50, // ~$0.05/1K (Anthropic: $5/1M)
		output: 250, // ~$0.25/1K (Anthropic: $25/1M)
	},

	// =========================================================================
	// GOOGLE GEMINI MODELS
	// =========================================================================

	// Gemini 1.5 Flash - Budget tier
	"gemini-1.5-flash": {
		input: 1, // ~$0.001/1K (Google: $0.075/1M)
		output: 3, // ~$0.003/1K (Google: $0.30/1M)
	},

	// Gemini 1.5 Pro - Standard tier
	"gemini-1.5-pro": {
		input: 12, // ~$0.012/1K (Google: $1.25/1M)
		output: 50, // ~$0.05/1K (Google: $5/1M)
	},

	// Gemini 2.0 Flash - Enhanced budget
	"gemini-2.0-flash": {
		input: 1, // ~$0.001/1K (Google: $0.10/1M)
		output: 4, // ~$0.004/1K (Google: $0.40/1M)
	},

	// Gemini 2.0 Flash-Lite - Ultra budget
	"gemini-2.0-flash-lite": {
		input: 1, // ~$0.001/1K (Google: $0.075/1M)
		output: 3, // ~$0.003/1K (Google: $0.30/1M)
	},

	// Gemini 2.5 Flash - Mid-tier
	"gemini-2.5-flash": {
		input: 3, // ~$0.003/1K (Google: $0.30/1M)
		output: 25, // ~$0.025/1K (Google: $2.50/1M)
	},

	// Gemini 2.5 Flash-Lite
	"gemini-2.5-flash-lite": {
		input: 1, // ~$0.001/1K (Google: $0.10/1M)
		output: 4, // ~$0.004/1K (Google: $0.40/1M)
	},

	// Gemini 2.5 Pro
	"gemini-2.5-pro": {
		input: 12, // ~$0.012/1K (Google: $1.25/1M for <=200K tokens)
		output: 100, // ~$0.10/1K (Google: $10/1M)
	},

	// Gemini 3 Models (Projected pricing)
	"gemini-3-flash": {
		input: 3, // ~$0.003/1K (projected next-gen budget)
		output: 10, // ~$0.01/1K
	},
	"gemini-3-pro": {
		input: 20, // ~$0.02/1K (Google: ~$2/1M)
		output: 120, // ~$0.12/1K (Google: ~$12/1M)
	},
	"gemini-3-ultra": {
		input: 100, // ~$0.10/1K (projected next-gen premium)
		output: 400, // ~$0.40/1K
	},

	// =========================================================================
	// XAI GROK MODELS
	// =========================================================================

	// Grok 2 - Standard tier
	"grok-2": {
		input: 20, // ~$0.02/1K (xAI: $2/1M)
		output: 100, // ~$0.10/1K (xAI: $10/1M)
	},
	"grok-2-vision": {
		input: 20, // ~$0.02/1K (xAI: $2/1M)
		output: 100, // ~$0.10/1K (xAI: $10/1M)
	},

	// Grok 3 - Premium tier
	"grok-3": {
		input: 30, // ~$0.03/1K (xAI: $3/1M)
		output: 150, // ~$0.15/1K (xAI: $15/1M)
	},
	"grok-3-fast": {
		input: 50, // ~$0.05/1K (xAI: $5/1M)
		output: 250, // ~$0.25/1K (xAI: $25/1M)
	},
	"grok-3-mini": {
		input: 3, // ~$0.003/1K (xAI: $0.30/1M)
		output: 5, // ~$0.005/1K (xAI: $0.50/1M)
	},

	// Grok 4 - Latest (Released 2025)
	"grok-4": {
		input: 2, // ~$0.002/1K (xAI: $0.20/1M - highly competitive)
		output: 5, // ~$0.005/1K (xAI: $0.50/1M)
	},

	// =========================================================================
	// DEEPSEEK MODELS
	// =========================================================================

	// DeepSeek V3 - Ultra competitive pricing
	"deepseek-v3": {
		input: 3, // ~$0.003/1K (DeepSeek: $0.28/1M cache miss)
		output: 4, // ~$0.004/1K (DeepSeek: $0.42/1M)
	},

	// DeepSeek R1 - Reasoning model
	"deepseek-r1": {
		input: 6, // ~$0.006/1K (DeepSeek: $0.55/1M cache miss)
		output: 22, // ~$0.022/1K (DeepSeek: $2.19/1M)
	},

	// DeepSeek Coder
	"deepseek-coder": {
		input: 3, // ~$0.003/1K (DeepSeek: competitive)
		output: 4, // ~$0.004/1K
	},

	// =========================================================================
	// MISTRAL MODELS
	// =========================================================================

	// Mistral Large 3 (Latest - December 2025)
	"mistral-large": {
		input: 5, // ~$0.005/1K (Mistral: $0.50/1M)
		output: 15, // ~$0.015/1K (Mistral: $1.50/1M)
	},

	// Mistral Medium 3.1
	"mistral-medium": {
		input: 4, // ~$0.004/1K (Mistral: $0.40/1M)
		output: 20, // ~$0.02/1K (Mistral: $2/1M)
	},

	// Mistral Small - Budget tier
	"mistral-small": {
		input: 1, // ~$0.001/1K (Mistral: $0.10/1M)
		output: 3, // ~$0.003/1K (Mistral: $0.30/1M)
	},

	// =========================================================================
	// META LLAMA MODELS (via providers)
	// =========================================================================

	// Llama 3.1 Models
	"llama-3.1-405b": {
		input: 50, // ~$0.05/1K (varies by provider)
		output: 150, // ~$0.15/1K
	},
	"llama-3.1-70b": {
		input: 9, // ~$0.009/1K (Together: $0.88/1M)
		output: 9, // ~$0.009/1K (Together: $0.88/1M)
	},
	"llama-3.1-8b": {
		input: 1, // ~$0.001/1K
		output: 1, // ~$0.001/1K
	},

	// Llama 3.2 Models
	"llama-3.2-90b": {
		input: 9, // ~$0.009/1K (Fireworks: $0.90/1M)
		output: 9, // ~$0.009/1K
	},
	"llama-3.2-11b": {
		input: 2, // ~$0.002/1K (Fireworks: $0.20/1M)
		output: 2, // ~$0.002/1K
	},
	"llama-3.2-3b": {
		input: 1, // ~$0.001/1K (Together: $0.06/1M)
		output: 1, // ~$0.001/1K
	},
	"llama-3.2-1b": {
		input: 1, // ~$0.001/1K (Fireworks: $0.10/1M)
		output: 1, // ~$0.001/1K
	},

	// Llama 3.3 Models
	"llama-3.3-70b": {
		input: 2, // ~$0.002/1K (Together: $0.23/1M)
		output: 4, // ~$0.004/1K (Together: $0.40/1M)
	},

	// Llama 4 Models (Released 2025)
	"llama-4-scout": {
		input: 2, // ~$0.002/1K (competitive pricing)
		output: 4, // ~$0.004/1K
	},
	"llama-4-maverick": {
		input: 5, // ~$0.005/1K
		output: 15, // ~$0.015/1K
	},

	// =========================================================================
	// COHERE MODELS
	// =========================================================================

	// Command R+ - Premium
	"command-r-plus": {
		input: 25, // ~$0.025/1K (Cohere: $2.50/1M)
		output: 100, // ~$0.10/1K (Cohere: $10/1M)
	},

	// Command R - Standard
	"command-r": {
		input: 5, // ~$0.005/1K (Cohere: $0.50/1M)
		output: 15, // ~$0.015/1K (Cohere: $1.50/1M)
	},

	// Command - Legacy
	command: {
		input: 10, // ~$0.01/1K (Cohere: $1/1M)
		output: 20, // ~$0.02/1K (Cohere: $2/1M)
	},

	// =========================================================================
	// MOONSHOT / KIMI MODELS
	// =========================================================================

	// Kimi K1
	"kimi-k1": {
		input: 10, // ~$0.01/1K (Moonshot: ~$1/1M)
		output: 40, // ~$0.04/1K (Moonshot: ~$4/1M)
	},

	// Kimi K2 (Latest - 2025)
	"kimi-k2": {
		input: 15, // ~$0.015/1K (estimated: ~$1.5/1M)
		output: 60, // ~$0.06/1K (estimated: ~$6/1M)
	},

	// =========================================================================
	// ALIBABA QWEN MODELS
	// =========================================================================

	// Qwen 2.5 Models
	"qwen-2.5-72b": {
		input: 5, // ~$0.005/1K (competitive pricing)
		output: 15, // ~$0.015/1K
	},
	"qwen-2.5-32b": {
		input: 2, // ~$0.002/1K
		output: 6, // ~$0.006/1K
	},
	"qwen-2.5-coder": {
		input: 2, // ~$0.002/1K
		output: 6, // ~$0.006/1K
	},

	// =========================================================================
	// AI21 MODELS
	// =========================================================================

	// Jamba Models
	"jamba-1.5-large": {
		input: 20, // ~$0.02/1K (AI21: $2/1M)
		output: 80, // ~$0.08/1K (AI21: $8/1M)
	},
	"jamba-1.5-mini": {
		input: 2, // ~$0.002/1K (AI21: $0.20/1M)
		output: 4, // ~$0.004/1K (AI21: $0.40/1M)
	},
} as const;

export type CreditModel = keyof typeof creditCosts;

// ============================================================================
// ASKBI AGENT MODEL TIERS
// ============================================================================

/**
 * Two-tier model selection for the AskBI agent. The steps differ wildly in
 * difficulty, so we don't run one model for everything:
 *
 * - `sql`   — SQL generation / planning / repair. Reasoning-heavy; correctness
 *             leans on it, so it gets a strong model. STRONG-BY-DEFAULT, then
 *             tune DOWN with the cap-hit / repair-frequency telemetry from the
 *             agent — never guess the cost/quality tradeoff up front. A weaker
 *             model here fails *safely* (validators → repair → honest "couldn't
 *             build a safe query"), never a confident wrong answer, so this
 *             trades success-rate/latency/cost, not safety.
 * - `light` — intent classification (the viz `intent` enum) + the narrative.
 *             Near-trivial; runs on a cheap current model.
 *
 * Both are one-line config swaps and MUST exist in `creditCosts` so every run
 * is metered. Model strings/prices verified against OpenAI's live list (2026).
 */
export const askbiModels = {
	sql: "gpt-5.5",
	light: "gpt-5.4-mini",
} satisfies Record<"sql" | "light", CreditModel>;

export type AskBiModelTier = keyof typeof askbiModels;

// ============================================================================
// CHAT MODELS CONFIGURATION
// ============================================================================

/**
 * Models available for the AI chat feature.
 * These must have corresponding entries in creditCosts above.
 *
 * Tier levels:
 * - budget: Low cost, fast response, good for simple tasks
 * - standard: Balanced cost/capability, recommended for most use cases
 * - premium: Highest capability, best for complex reasoning tasks
 */
export const chatModels = [
	{
		id: "gpt-4o-mini" as const,
		name: "GPT-4o Mini",
		description: "Fast & affordable",
		tier: "budget" as const,
		provider: "openai" as const,
	},
	{
		id: "gpt-4o" as const,
		name: "GPT-4o",
		description: "Balanced performance",
		tier: "standard" as const,
		provider: "openai" as const,
	},
	{
		id: "gpt-4-turbo" as const,
		name: "GPT-4 Turbo",
		description: "High capability",
		tier: "premium" as const,
		provider: "openai" as const,
	},
	{
		id: "o1-mini" as const,
		name: "o1 Mini",
		description: "Advanced reasoning",
		tier: "premium" as const,
		provider: "openai" as const,
	},
] as const;

export type ChatModel = (typeof chatModels)[number];
export type ChatModelId = ChatModel["id"];
export type ChatModelTier = ChatModel["tier"];
export type ChatModelProvider = ChatModel["provider"];

/** Default model for new chats */
export const DEFAULT_CHAT_MODEL: ChatModelId = "gpt-4o-mini";

/**
 * Get credit cost info for a chat model (average per message estimate)
 * Returns approximate credits for a typical 500 input / 500 output token exchange
 */
export function getChatModelCostEstimate(modelId: ChatModelId): number {
	const costs = creditCosts[modelId];
	// Estimate based on ~500 input tokens + ~500 output tokens (typical chat message)
	const inputCost = Math.ceil((500 / 1000) * costs.input);
	const outputCost = Math.ceil((500 / 1000) * costs.output);
	return inputCost + outputCost;
}

// Price configuration type
export type PriceConfig = {
	id: string;
	stripePriceId: string;
	amount: number;
	currency: string;
} & (
	| {
			type: "recurring";
			interval: "month" | "year" | "week" | "day";
			intervalCount: number;
			seatBased?: boolean;
			trialDays?: number;
	  }
	| {
			type: "one_time";
	  }
);

// Plan limits type
export type PlanLimits = {
	maxMembers: number; // -1 for unlimited
	maxStorage: number; // in GB, -1 for unlimited
};

// Base plan type
type BasePlan = {
	id: string;
	name: string;
	description: string;
	features: string[];
	limits?: PlanLimits;
};

// Free plan type
type FreePlan = BasePlan & {
	isFree: true;
	prices?: never;
	recommended?: never;
	isEnterprise?: never;
};

// Paid plan type
type PaidPlan = BasePlan & {
	isFree?: never;
	prices: PriceConfig[];
	recommended?: boolean;
	isEnterprise?: never;
};

// Enterprise plan type
type EnterprisePlan = BasePlan & {
	isFree?: never;
	prices?: never;
	recommended?: never;
	isEnterprise: true;
};

// Union type for all plan types
export type Plan = FreePlan | PaidPlan | EnterprisePlan;

// Billing configuration type
export type BillingConfig = {
	enabled: boolean;
	defaultCurrency: string;
	plans: Record<string, Plan>;
};
