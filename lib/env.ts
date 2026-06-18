import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";
import { resolvePostgresConnectionUrl } from "@/lib/db/resolve-postgres-url";

const isProductionDeploy =
	process.env.NODE_ENV === "production" ||
	process.env.VERCEL_ENV === "production";

export const env = createEnv({
	/**
	 * Server-side environment variables schema.
	 * These are only available on the server.
	 */
	server: {
		// Node
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),

		// Auth
		BETTER_AUTH_SECRET: z.string().min(1),
		GOOGLE_CLIENT_ID: z.string().optional(),
		GOOGLE_CLIENT_SECRET: z.string().optional(),

		// Database
		POSTGRES_USER: z.string().default("postgres"),
		POSTGRES_PASSWORD: z.string().default("password"),
		POSTGRES_DB: z.string().default("database"),
		POSTGRES_HOST: z.string().default("localhost"),
		POSTGRES_PORT: z.string().default("5432"),
		DATABASE_URL: z.string().url(),

		// AskBI CSV uploads — imported CSVs are loaded into a Postgres database
		// the app owns (admin writes via POSTGRES_*; AskBI queries via the
		// read-only role). Local defaults match the demo seed; in production set
		// these to an isolated uploads database + role.
		ASKBI_UPLOADS_DB: z.string().default("askbi_uploads"),
		ASKBI_READONLY_USER: z.string().default("askbi_readonly"),
		ASKBI_READONLY_PASSWORD: z.string().default("askbi_readonly_password"),

		// Email (required in production — Resend needs both vars to send)
		EMAIL_FROM: isProductionDeploy ? z.string().min(1) : z.string().optional(),
		RESEND_API_KEY: isProductionDeploy
			? z.string().min(1)
			: z.string().optional(),

		// Monitoring / Sentry
		SENTRY_ORG: z.string().optional(),
		SENTRY_PROJECT: z.string().optional(),
		SENTRY_AUTH_TOKEN: z.string().optional(),

		// Storage / S3
		S3_ACCESS_KEY_ID: z.string().optional(),
		S3_SECRET_ACCESS_KEY: z.string().optional(),
		S3_ENDPOINT: z.string().optional(),
		S3_REGION: z.string().optional(),

		// AskBI - encryption key for data-source credentials at rest (AES-256-GCM).
		// Required: 32 bytes as 64 hex chars (`openssl rand -hex 32`) or base64 of
		// 32 bytes (`openssl rand -base64 32`). Validated/parsed in lib/crypto.
		ENCRYPTION_KEY: z.string().min(1),

		// Stripe / Billing
		STRIPE_SECRET_KEY: z.string().optional(),
		STRIPE_WEBHOOK_SECRET: z.string().optional(),

		// Cloudflare Turnstile (Captcha)
		TURNSTILE_SECRET_KEY: z.string().optional(),

		// Build / CI
		ANALYZE: z
			.string()
			.default("false")
			.transform((val) => val === "true"),
		CI: z.string().optional(),
		VERCEL: z.string().optional(),
		VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
	},

	/**
	 * Client-side environment variables schema.
	 * These must be prefixed with `NEXT_PUBLIC_` to be exposed to the client.
	 */
	client: {
		NEXT_PUBLIC_NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		NEXT_PUBLIC_LOG_LEVEL: z
			.enum(["trace", "debug", "info", "warn", "error", "fatal"])
			.default("info"),
		NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
		NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
		NEXT_PUBLIC_IMAGES_BUCKET_NAME: z.string().optional(),

		// Stripe / Billing (public)
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

		// Cloudflare Turnstile (Captcha)
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
		// Stripe Price IDs for each plan
		NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
		NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
		NEXT_PUBLIC_STRIPE_PRICE_LIFETIME: z.string().optional(),

		// Stripe Price IDs for credit packages
		NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER: z.string().optional(),
		NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC: z.string().optional(),
		NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO: z.string().optional(),

		// Vercel-provided
		NEXT_PUBLIC_VERCEL_ENV: z
			.enum(["development", "preview", "production"])
			.optional(),
		NEXT_PUBLIC_VERCEL_URL: z.string().optional(),
		NEXT_PUBLIC_VERCEL_BRANCH_URL: z.string().optional(),
		NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: z.string().optional(),
		NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes
	 * (e.g. middlewares) or client-side, so we need to destruct manually.
	 */
	runtimeEnv: {
		// Server
		NODE_ENV: process.env.NODE_ENV,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		POSTGRES_USER: process.env.POSTGRES_USER,
		POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
		POSTGRES_DB: process.env.POSTGRES_DB,
		POSTGRES_HOST: process.env.POSTGRES_HOST,
		POSTGRES_PORT: process.env.POSTGRES_PORT,
		DATABASE_URL: resolvePostgresConnectionUrl(),
		ASKBI_UPLOADS_DB: process.env.ASKBI_UPLOADS_DB,
		ASKBI_READONLY_USER: process.env.ASKBI_READONLY_USER,
		ASKBI_READONLY_PASSWORD: process.env.ASKBI_READONLY_PASSWORD,
		EMAIL_FROM: process.env.EMAIL_FROM,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		SENTRY_ORG: process.env.SENTRY_ORG,
		SENTRY_PROJECT: process.env.SENTRY_PROJECT,
		SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
		S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
		S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
		S3_ENDPOINT: process.env.S3_ENDPOINT,
		S3_REGION: process.env.S3_REGION,
		ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
		ANALYZE: process.env.ANALYZE,
		CI: process.env.CI,
		VERCEL: process.env.VERCEL,
		VERCEL_ENV: process.env.VERCEL_ENV,

		// Client
		NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
		NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
		NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
		NEXT_PUBLIC_IMAGES_BUCKET_NAME: process.env.NEXT_PUBLIC_IMAGES_BUCKET_NAME,
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
		NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY:
			process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
		NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY:
			process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY,
		NEXT_PUBLIC_STRIPE_PRICE_LIFETIME:
			process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME,
		NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER:
			process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER,
		NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC:
			process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC,
		NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO:
			process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO,
		NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
		NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
		NEXT_PUBLIC_VERCEL_BRANCH_URL: process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL,
		NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF:
			process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
		NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
			process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
	},

	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
	 * This is useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,

	/**
	 * Makes it so that empty strings are treated as undefined.
	 * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
