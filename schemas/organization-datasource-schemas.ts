import { z } from "zod/v4";
import { DataSourceType } from "@/lib/db/schema/enums";

// A Postgres schema identifier; quoted at use, but constrained here anyway.
const schemaNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(63)
	.regex(/^[A-Za-z0-9_]+$/, "Invalid schema name");

// Non-secret connection identity + the password (write-only; never read back).
const postgresConnectionSchema = z.object({
	host: z.string().trim().min(1, "Host is required").max(255),
	port: z.number().int().min(1).max(65535).default(5432),
	database: z.string().trim().min(1, "Database is required").max(255),
	user: z.string().trim().min(1, "User is required").max(255),
	password: z.string().max(1024).optional().default(""),
	ssl: z.boolean().default(true),
	schemas: z.array(schemaNameSchema).min(1).max(20).default(["public"]),
});

export const createDataSourceSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	// MVP: PostgreSQL only. Widen to a discriminated union when MySQL/file land.
	type: z.literal(DataSourceType.postgres),
	connection: postgresConnectionSchema,
});

// On update, the password is optional: omit/blank to keep the existing secret,
// provide a value to rotate it.
const postgresConnectionUpdateSchema = postgresConnectionSchema.extend({
	password: z.string().max(1024).optional(),
});

export const updateDataSourceSchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1).max(200).optional(),
	connection: postgresConnectionUpdateSchema.optional(),
});

export const dataSourceIdSchema = z.object({
	id: z.string().uuid(),
});

// Import CSV: the raw file text rides in the payload (capped), parsed + loaded
// into the uploads database on the server. ~8MB of text is a generous MVP cap.
export const importCsvSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	csv: z
		.string()
		.min(1, "The file is empty")
		.max(8_000_000, "File is too large (8MB max)"),
	hasHeader: z.boolean().default(true),
});

export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;
export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;
export type PostgresConnectionInput = z.infer<typeof postgresConnectionSchema>;
export type ImportCsvInput = z.infer<typeof importCsvSchema>;
