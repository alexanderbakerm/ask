import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { createMockEnv } from "./mock-env-constants";
import { getIsolatedDatabaseUrl, truncateDb } from "./setup-db";

// Environment stubs and module mocks at module scope so they apply before imports
vi.stubEnv("NODE_ENV", "test");

// Mock the env module globally for database tests
// Use a getter to dynamically return the database URL
vi.mock("@/lib/env", () => ({
	env: {
		...createMockEnv({}),
		get DATABASE_URL() {
			// Try to get from global variable first, then from file, then fallback
			let databaseUrl = globalThis.__TEST_DATABASE_URL__;

			if (!databaseUrl) {
				try {
					const fs = require("node:fs");
					const path = require("node:path");
					const TEST_DB_INFO_FILE = path.join(
						process.cwd(),
						".test-db-info.json",
					);
					const dbInfo = JSON.parse(
						fs.readFileSync(TEST_DB_INFO_FILE, "utf-8"),
					);
					databaseUrl = dbInfo.connectionString;
				} catch {
					// Fallback to default
					databaseUrl = "postgres://test:test@localhost:5432/test";
				}
			}

			// Construct isolated URL synchronously
			// This allows modules like lib/db/client.ts to get the correct URL immediately on import
			// without waiting for async setup in beforeAll
			const workerId = process.env.VITEST_WORKER_ID || "1";
			const schemaName = `test_${workerId}`;

			// Check if URL already has query params
			const safeUrl = databaseUrl || "postgres://test:test@localhost:5432/test";
			const separator = safeUrl.includes("?") ? "&" : "?";
			return `${safeUrl}${separator}options=-c%20search_path%3D${schemaName},public`;
		},
	},
}));

// Allow testing server-only modules
vi.mock("server-only", () => {
	return {};
});

vi.mock("react", async (importOriginal) => {
	const testCache = <T extends (...args: unknown[]) => unknown>(func: T) =>
		func;
	const originalModule = await importOriginal<typeof import("react")>();
	return {
		...originalModule,
		cache: testCache,
	};
});

beforeAll(async () => {
	// Wait for global container to be ready
	let databaseUrl = globalThis.__TEST_DATABASE_URL__;

	// If global variable is not available, try reading from file
	if (!databaseUrl) {
		try {
			const { readFileSync } = await import("node:fs");
			const { join } = await import("node:path");
			const TEST_DB_INFO_FILE = join(process.cwd(), ".test-db-info.json");
			const dbInfo = JSON.parse(readFileSync(TEST_DB_INFO_FILE, "utf-8"));
			databaseUrl = dbInfo.connectionString;
		} catch (error) {
			console.error("Failed to read database info from file:", error);
		}
	}

	if (!databaseUrl) {
		throw new Error(
			"Global test database container not available. Make sure global setup is configured.",
		);
	}

	// Set up isolated database URL (this will create a separate schema for this worker)
	const isolatedUrl = await getIsolatedDatabaseUrl();
	vi.stubEnv("DATABASE_URL", isolatedUrl);
}, 30_000); // 30 second timeout for schema setup

afterAll(() => {
	vi.resetAllMocks();
	// No need to clean up container - global teardown handles it
});

beforeEach(async () => {
	// Truncate database before each test for isolation
	// This will only truncate tables in this worker's schema
	await truncateDb();
});

// Export for type safety
declare global {
	var __TEST_DATABASE_URL__: string | undefined;
}
