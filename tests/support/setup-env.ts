import { vi } from "vitest";
import { createMockEnv } from "./mock-env-constants";

// Mock auth modules to prevent schema access during module loading for unit tests
// NOTE: Database tests should not use this setup file, they have their own setup
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue(null),
		},
	},
}));

vi.mock("@/lib/auth/server", () => ({
	getSession: vi.fn().mockResolvedValue(null),
	assertUserIsOrgMember: vi.fn().mockResolvedValue({
		organization: { id: "test-org-id", name: "Test Org" },
		membership: { role: "owner" },
	}),
}));

vi.mock("@/lib/auth/index", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue(null),
		},
	},
}));

// Mock the env module globally for local development
// In CI, this file is not used - see vitest.config.mts
vi.mock("@/lib/env", () => ({
	env: createMockEnv({
		DATABASE_URL: "postgres://test:test@localhost:5432/test",
	}),
}));

// Mock database module to prevent actual database connections in unit tests
// NOTE: Database tests should not use this setup file, they have their own setup
vi.mock("@/lib/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/db")>();
	return {
		...actual,
		db: {
			query: {},
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			select: vi.fn(),
		},
	};
});

// Allow testing server-only modules
vi.mock("server-only", () => {
	return {};
});

// Note: Database mocking removed - CI uses real PostgreSQL service
// Local development should avoid database-dependent tests via vitest config exclusions
