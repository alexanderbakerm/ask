#!/usr/bin/env node
/**
 * Create + seed the AskBI demo database (`askbi_demo`) on the same Postgres
 * instance the app uses. Idempotent and safe to re-run.
 *
 *   npm run db:demo
 *
 * Connects as the Postgres superuser (POSTGRES_* from .env) to:
 *   1. create the `askbi_demo` database if it does not exist, then
 *   2. apply scripts/demo-db/demo.sql inside it (schema, data, read-only grant).
 *
 * Then connect AskBI to it with the READ-ONLY role:
 *   host=localhost port=5432 database=askbi_demo
 *   user=askbi_readonly password=askbi_readonly_password
 *   schema=sales  ssl=off
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DB = "askbi_demo";

const admin = {
	host: process.env.POSTGRES_HOST || "localhost",
	port: Number(process.env.POSTGRES_PORT || 5432),
	user: process.env.POSTGRES_USER || "postgres",
	password: process.env.POSTGRES_PASSWORD || "password",
};

async function main() {
	// 1) Maintenance connection → create the database if missing.
	const maintenance = new Client({ ...admin, database: "postgres" });
	await maintenance.connect();
	try {
		const existing = await maintenance.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[DEMO_DB],
		);
		if (existing.rowCount === 0) {
			// DEMO_DB is a fixed constant — safe to interpolate.
			await maintenance.query(`CREATE DATABASE ${DEMO_DB}`);
			console.log(`Created database "${DEMO_DB}".`);
		} else {
			console.log(`Database "${DEMO_DB}" already exists — reseeding.`);
		}
	} finally {
		await maintenance.end();
	}

	// 2) Apply the committed schema + data + grant inside askbi_demo.
	const sql = readFileSync(join(__dirname, "demo-db", "demo.sql"), "utf8");
	const demo = new Client({ ...admin, database: DEMO_DB });
	await demo.connect();
	try {
		await demo.query(sql);
	} finally {
		await demo.end();
	}

	console.log("Applied demo schema, data, and read-only grant.");
	console.log(
		"\nConnect AskBI to this source (read-only role):\n" +
			`  host=${admin.host}  port=${admin.port}  database=${DEMO_DB}\n` +
			"  user=askbi_readonly  password=askbi_readonly_password\n" +
			"  schema=sales  ssl=off",
	);
}

main().catch((error) => {
	console.error("Demo DB seed failed:", error);
	process.exit(1);
});
