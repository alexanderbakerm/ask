// Shared mock environment variables for testing
export const MOCK_ENV_VARS = {
	NODE_ENV: "test",
	BETTER_AUTH_SECRET: "test-better-auth-secret-32-chars-long",
	DATABASE_URL: "postgres://test:test@localhost:5432/test",
	RESEND_API_KEY: "test-resend-api-key-32-chars-long",
	EMAIL_FROM: "test@example.com",
	S3_ENDPOINT: "https://test-s3-endpoint.com",
	S3_ACCESS_KEY_ID: "test-s3-access-key",
	S3_SECRET_ACCESS_KEY: "test-s3-secret-key",
	S3_REGION: "us-east-1",
	// 64 hex chars = 32 bytes; obviously-fake test-only key
	ENCRYPTION_KEY:
		"0000000000000000000000000000000000000000000000000000000000000000",
} as const;

// Helper function to create mock env object for different scenarios
export const createMockEnv = (
	overrides: Record<string, string | number | boolean | undefined> = {},
) => ({
	...MOCK_ENV_VARS,
	...overrides,
});
