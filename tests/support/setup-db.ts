// Adapted from https://www.answeroverflow.com/m/1128519076952682517

import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { GenericContainer } from "testcontainers";
import * as schema from "@/lib/db/schema";

async function waitForDatabase(
	connectionString: string,
	maxRetries = 30,
	delay = 250,
) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			console.log(
				`Attempting database connection (attempt ${i + 1}/${maxRetries})...`,
			);
			const testDb = drizzle(connectionString, { schema });
			await testDb.execute(sql`SELECT 1`);
			await (testDb.$client as unknown as { end: () => Promise<void> }).end();
			console.log("Database connection successful!");
			return;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.log(
				`Database connection failed (attempt ${i + 1}/${maxRetries}): ${errorMessage}`,
			);

			if (i === maxRetries - 1) {
				throw new Error(
					`Database failed to become ready after ${maxRetries} attempts. Last error: ${errorMessage}`,
				);
			}

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}

export async function setupDockerTestDb() {
	console.log("Starting Docker test database setup...");

	const POSTGRES_PORT = 5445;

	console.log("Initializing PostgreSQL container...");
	const container = await new GenericContainer("supabase/postgres:15.8.1.100")
		.withEnvironment({ POSTGRES_PASSWORD: "password" })
		.withExposedPorts({ host: POSTGRES_PORT, container: 5432 })
		.withCommand([
			"postgres",
			"-c",
			"config_file=/etc/postgresql/postgresql.conf",
		])
		.withHealthCheck({
			test: [
				"CMD-SHELL",
				"PGPASSWORD=password pg_isready --host localhost --username postgres --dbname postgres",
			],
			interval: 250,
			timeout: 3000,
			retries: 1000,
		})
		.start();

	console.log("PostgreSQL container started successfully.");

	const adminConnectionString = `postgres://supabase_admin:password@${container.getHost()}:${container.getMappedPort(5432)}/postgres`;

	console.log("Waiting for database to be ready...");
	await waitForDatabase(adminConnectionString);

	const connectionString = `postgres://postgres:password@${container.getHost()}:${container.getMappedPort(5432)}/postgres`;
	console.log(`Connecting to database: ${connectionString}`);
	const db = drizzle(connectionString, { schema });

	console.log("Applying migrations...");
	const migrationPath = path.join(
		__dirname,
		"..",
		"..",
		"lib",
		"db",
		"migrations",
	);
	console.log("Resolved migration path:", migrationPath);
	const metaDir = path.join(migrationPath, "meta");
	if (!fs.existsSync(metaDir)) {
		fs.mkdirSync(metaDir, { recursive: true });
	}
	console.log("Migration path:", migrationPath);
	await migrate(db, {
		migrationsFolder: migrationPath,
	});
	console.log("Migrations applied successfully.");

	console.log("Confirming database connection...");
	const confirmDatabaseReady = await db.execute(sql`SELECT 1`);
	console.log("Database connection confirmed.");

	console.log("Docker test database setup completed.");

	return {
		container,
		db,
		confirmDatabaseReady,
		client: db.$client,
		connectionString,
	};
}

// Global test database pool for isolation
const testDatabasePool = new Map<string, { url: string; schema?: string }>();

export const getIsolatedDatabaseUrl = async (): Promise<string> => {
	const workerId = process.env.VITEST_WORKER_ID || "1";

	// Validate workerId is numeric to prevent schema name tampering
	if (!/^[0-9]+$/.test(workerId)) {
		throw new Error(
			`Invalid VITEST_WORKER_ID: expected numeric value, got '${workerId}'`,
		);
	}

	const poolKey = `test_db_${workerId}`;

	if (testDatabasePool.has(poolKey)) {
		const config = testDatabasePool.get(poolKey);
		if (!config) {
			throw new Error(`Database URL not found for worker ${workerId}`);
		}
		return config.url;
	}

	// Check if we have a global test container available (from global setup)
	let globalDatabaseUrl = globalThis.__TEST_DATABASE_URL__;

	// If global variable is not available, try reading from file
	if (!globalDatabaseUrl) {
		try {
			const { readFileSync } = await import("node:fs");
			const { join } = await import("node:path");
			const TEST_DB_INFO_FILE = join(process.cwd(), ".test-db-info.json");
			const dbInfo = JSON.parse(readFileSync(TEST_DB_INFO_FILE, "utf-8"));
			globalDatabaseUrl = dbInfo.connectionString;
		} catch {
			// File might not exist, continue with process.env.DATABASE_URL
		}
	}

	const baseDatabaseUrl = globalDatabaseUrl || process.env.DATABASE_URL;
	if (!baseDatabaseUrl) {
		throw new Error(
			"DATABASE_URL is not set and no global test container available.",
		);
	}

	// Always create isolated schemas for test isolation (both CI and local)
	const schemaName = `test_${workerId}`;

	// Create the schema if it doesn't exist
	await createTestSchema(schemaName, baseDatabaseUrl);

	// Append search_path to the connection string to enforce isolation
	const isolatedUrl = `${baseDatabaseUrl}?options=-c%20search_path%3D${schemaName},public`;

	// Store the base URL and schema name for later use
	testDatabasePool.set(poolKey, {
		url: baseDatabaseUrl,
		schema: schemaName,
	});

	return isolatedUrl;
};

export const getTestSchema = (): string | undefined => {
	const workerId = process.env.VITEST_WORKER_ID || "1";

	// Validate workerId is numeric to prevent schema name tampering
	if (!/^[0-9]+$/.test(workerId)) {
		throw new Error(
			`Invalid VITEST_WORKER_ID: expected numeric value, got '${workerId}'`,
		);
	}

	const poolKey = `test_db_${workerId}`;

	const config = testDatabasePool.get(poolKey);
	return config?.schema;
};

async function createTestSchema(schemaName: string, connectionString: string) {
	const { drizzle: drizzleClient } = await import("drizzle-orm/node-postgres");
	const { sql: sqlQuery } = await import("drizzle-orm");
	const { Client } = await import("pg");

	const client = new Client({ connectionString });
	await client.connect();
	const db = drizzleClient(client);

	// Use a hash of the schema name as the advisory lock key
	const lockKey = hashStringToInt32(schemaName);

	try {
		// Acquire an advisory lock for this specific schema
		// This prevents multiple workers from applying migrations to the same schema simultaneously
		await db.execute(sqlQuery`SELECT pg_advisory_lock(${lockKey})`);

		// Create schema if it doesn't exist
		await db.execute(
			sqlQuery`CREATE SCHEMA IF NOT EXISTS ${sqlQuery.identifier(schemaName)}`,
		);

		// Set the search path to use the test schema first, then public
		// This ensures all tables are created in the test schema
		await db.execute(
			sqlQuery`SET search_path TO ${sqlQuery.identifier(schemaName)}, public`,
		);

		// Check if we're using CI
		const isCI = process.env.CI === "true";

		if (isCI) {
			// In CI, migrations are already applied by the workflow
			// We just need to ensure the schema exists for isolation
			// No need to run migrations again
		} else {
			// Check if migrations have already been applied to this schema
			const migrationTableExists = await checkMigrationTableExists(
				db,
				schemaName,
			);

			if (!migrationTableExists) {
				// Run migrations for this schema
				const migrationPath = path.join(
					__dirname,
					"..",
					"..",
					"lib",
					"db",
					"migrations",
				);

				// Create a custom migration configuration that uses schema-specific table names
				await migrate(db, {
					migrationsFolder: migrationPath,
					migrationsTable: "__drizzle_migrations",
				});

				// Mark this schema as having migrations applied by creating a marker table
				await db.execute(
					sqlQuery`
						CREATE TABLE IF NOT EXISTS ${sqlQuery.identifier(schemaName)}.schema_migration_status (
							schema_name TEXT PRIMARY KEY,
							migrations_applied BOOLEAN DEFAULT TRUE,
							applied_at TIMESTAMP DEFAULT NOW()
						)
					`,
				);

				await db.execute(
					sqlQuery`
						INSERT INTO ${sqlQuery.identifier(schemaName)}.schema_migration_status (schema_name) 
						VALUES (${schemaName})
						ON CONFLICT (schema_name) DO NOTHING
					`,
				);
			}
		}
	} finally {
		// Release the advisory lock
		await db.execute(sqlQuery`SELECT pg_advisory_unlock(${lockKey})`);
		await client.end();
	}
}

// Helper function to convert string to 32-bit integer for advisory lock
function hashStringToInt32(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

// Helper function to check if migration table exists in the current schema
async function checkMigrationTableExists(
	db: {
		execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;
	},
	schemaName: string,
): Promise<boolean> {
	const { sql: sqlQuery } = await import("drizzle-orm");

	try {
		// Check for our custom migration status table first
		const statusResult = await db.execute(
			sqlQuery`
				SELECT EXISTS (
					SELECT FROM information_schema.tables 
					WHERE table_schema = ${schemaName} 
					AND table_name = 'schema_migration_status'
				) as exists
			`,
		);

		if ((statusResult.rows[0] as { exists: boolean })?.exists) {
			return true;
		}

		// Fallback: check for drizzle migrations table
		const migrationResult = await db.execute(
			sqlQuery`
				SELECT EXISTS (
					SELECT FROM information_schema.tables 
					WHERE table_schema = ${schemaName} 
					AND table_name = '__drizzle_migrations'
				) as exists
			`,
		);
		return (migrationResult.rows[0] as { exists: boolean })?.exists ?? false;
	} catch {
		return false;
	}
}

export const truncateDb = async () => {
	const nodeEnv = process.env.NODE_ENV;
	if (nodeEnv !== "test") {
		throw new Error(
			"This function should only be called in test environments.",
		);
	}

	const databaseUrl = await getIsolatedDatabaseUrl();

	const { drizzle: drizzleClient } = await import("drizzle-orm/node-postgres");
	const { sql: sqlQuery } = await import("drizzle-orm");
	const { Client } = await import("pg");

	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	const db = drizzleClient(client);

	try {
		const workerId = process.env.VITEST_WORKER_ID || "1";

		// Validate workerId is numeric to prevent schema name tampering
		if (!/^[0-9]+$/.test(workerId)) {
			throw new Error(
				`Invalid VITEST_WORKER_ID: expected numeric value, got '${workerId}'`,
			);
		}

		const schemaName = `test_${workerId}`;

		// Get tables from the test schema
		const tablenames = await db.execute(
			sqlQuery`SELECT tablename FROM pg_tables WHERE schemaname = ${schemaName}`,
		);
		const tables = tablenames.rows
			.map((row) => (row as { tablename: string }).tablename)
			.filter((tablename) => tablename !== "__drizzle_migrations")
			.map((tablename) => {
				// Properly escape both schema and table identifiers
				const escapedSchema = `"${schemaName.replace(/"/g, '""')}"`;
				const escapedTable = `"${tablename.replace(/"/g, '""')}"`;
				return `${escapedSchema}.${escapedTable}`;
			})
			.join(", ");

		if (tables) {
			try {
				await db.execute(
					sqlQuery`TRUNCATE TABLE ${sqlQuery.raw(tables)} RESTART IDENTITY CASCADE`,
				);
			} catch (error) {
				console.log("Error truncating tables:", error);
			}
		}
	} finally {
		// Close the database connection to prevent leaks
		await client.end();
	}
};

// Export for type safety
declare global {
	var __TEST_DATABASE_URL__: string | undefined;
	var __TEST_DATABASE_CONTAINER__:
		| Awaited<ReturnType<typeof setupDockerTestDb>>
		| undefined;
}
