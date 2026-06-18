// Set environment variables BEFORE any imports to prevent validation errors during module loading
// This must be at the very top before any other imports
// Always set NODE_ENV to 'test' when running vitest
if (process.env.VITEST === "true") {
	(process.env as Record<string, string>).NODE_ENV = "test";
}

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
	// Set timezone to UTC for consistent test results
	process.env.TZ = "UTC";
	// Helper to generate obviously fake tokens
	const dummy = (len: number) => "x".repeat(len);
	process.env.DATABASE_URL =
		process.env.DATABASE_URL || "postgres://mock:mock@localhost:5432/mock";
	process.env.BETTER_AUTH_SECRET =
		process.env.BETTER_AUTH_SECRET || `test-${dummy(32)}`;
	process.env.RESEND_API_KEY =
		process.env.RESEND_API_KEY || `test-${dummy(32)}`;
	process.env.EMAIL_FROM = process.env.EMAIL_FROM || "test@example.com";
	// AskBI: 64 hex chars = 32 bytes; test-only AES key
	process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0".repeat(64);
}

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Check if we should run database tests (need Docker)
const runDbTests = process.env.RUN_DB_TESTS === "true";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		coverage: {
			provider: "v8",
		},
		server: {
			deps: {
				// tRPC imports next/navigation without an extension, causing a similar error to this https://github.com/nextauthjs/next-auth/discussions/9385
				inline: ["@trpc/server"],
			},
		},
		passWithNoTests: true,
		watch: false,
		testTimeout: 10_000,
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.next/**",
			"**/e2e/**",
			// Exclude database tests unless RUN_DB_TESTS is true
			...(runDbTests
				? []
				: [
						"**/organizations.test.ts",
						"**/tests/trpc/routers/**",
						"**/*db*.test.ts",
					]),
		],
		include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)", "lib/**/*.test.ts"],
		environment: "node",
		pool: runDbTests ? "forks" : "threads",
		fileParallelism: !runDbTests,
		sequence: {
			concurrent: !runDbTests,
		},
		// Only use globalSetup for database tests
		globalSetup: runDbTests ? "./tests/support/setup-global.ts" : undefined,
		setupFiles: runDbTests
			? ["./tests/support/setup-shared-db.ts"]
			: ["./tests/support/setup-env.ts"],
	},
});
