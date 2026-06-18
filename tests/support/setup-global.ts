import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupDockerTestDb } from "./setup-db";

let globalTestContainer: Awaited<ReturnType<typeof setupDockerTestDb>> | null =
	null;

const TEST_DB_INFO_FILE = join(process.cwd(), ".test-db-info.json");

export async function setup() {
	// Create a single shared container for all tests
	globalTestContainer = await setupDockerTestDb();

	// Store the connection string in a file that tests can read
	const dbInfo = {
		connectionString: globalTestContainer.connectionString,
		containerId: globalTestContainer.container.getId(),
	};

	writeFileSync(TEST_DB_INFO_FILE, JSON.stringify(dbInfo, null, 2));

	// Also store in global variables as backup
	globalThis.__TEST_DATABASE_URL__ = globalTestContainer.connectionString;
	globalThis.__TEST_DATABASE_CONTAINER__ = globalTestContainer;
}

export async function teardown() {
	if (globalTestContainer) {
		// Close the database connection
		if (globalTestContainer.client) {
			await (
				globalTestContainer.client as unknown as { end: () => Promise<void> }
			).end();
		}

		// Stop the container
		if (globalTestContainer.container) {
			await globalTestContainer.container.stop();
		}

		globalTestContainer = null;
	}

	// Clean up global variables
	globalThis.__TEST_DATABASE_URL__ = undefined;
	globalThis.__TEST_DATABASE_CONTAINER__ = undefined;

	// Clean up the info file
	try {
		const { unlinkSync } = await import("node:fs");
		unlinkSync(TEST_DB_INFO_FILE);
	} catch {
		// File might not exist, ignore
	}
}

// Export for type safety
declare global {
	var __TEST_DATABASE_URL__: string | undefined;
	var __TEST_DATABASE_CONTAINER__:
		| Awaited<ReturnType<typeof setupDockerTestDb>>
		| undefined;
}
