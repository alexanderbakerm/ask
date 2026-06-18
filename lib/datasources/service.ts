import "server-only";

import { eq } from "drizzle-orm";
import { decryptJson } from "@/lib/crypto/secrets";
import type { db } from "@/lib/db";
import type { dataSourceTable } from "@/lib/db/schema";
import { catalogColumnTable, catalogTableTable } from "@/lib/db/schema";
import { createConnector } from "./factory";
import type { PostgresConnectionParams } from "./postgres-connector";
import type { Catalog } from "./types";

/** A persisted data-source row (full, including the encrypted secret blob). */
export type DataSourceRow = typeof dataSourceTable.$inferSelect;

/** The drizzle transaction handle passed to `db.transaction(async (tx) => …)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Non-secret connection identity persisted in plaintext `config`. */
export interface StoredConfig {
	host: string;
	port: number;
	database: string;
	user: string;
	ssl: boolean;
	schemas: string[];
	/** Persisted for Supavisor pooler reconnects (optional). */
	supabaseProjectRef?: string;
}

/** The secret half, encrypted at rest. */
interface StoredSecrets {
	password: string;
}

export function serializeConfig(config: StoredConfig): string {
	return JSON.stringify(config);
}

const DEFAULT_STORED_CONFIG: StoredConfig = {
	host: "",
	port: 5432,
	database: "",
	user: "",
	ssl: true,
	schemas: ["public"],
};

export function parseConfig(raw: string | null): StoredConfig {
	if (!raw) {
		return { ...DEFAULT_STORED_CONFIG };
	}
	try {
		return { ...DEFAULT_STORED_CONFIG, ...(JSON.parse(raw) as StoredConfig) };
	} catch {
		return { ...DEFAULT_STORED_CONFIG };
	}
}

/**
 * Build live connector params from a stored row by decrypting its secret.
 * Server-only; the decrypted password never leaves this layer.
 */
export function buildConnectorParams(
	row: DataSourceRow,
): PostgresConnectionParams {
	const config = parseConfig(row.config);
	let password = "";
	if (row.encryptedCredentials) {
		try {
			password = decryptJson<StoredSecrets>(row.encryptedCredentials).password;
		} catch {
			password = "";
		}
	}
	return {
		host: config.host,
		port: config.port,
		database: config.database,
		user: config.user,
		ssl: config.ssl,
		schemas: config.schemas,
		supabaseProjectRef: config.supabaseProjectRef,
		password,
	};
}

export function getConnectorForSource(row: DataSourceRow) {
	return createConnector(row.type, buildConnectorParams(row));
}

/**
 * The client-safe projection of a data source: non-secret connection identity
 * plus status. NEVER includes `encryptedCredentials` (not decrypted, and not
 * the ciphertext either — `hasCredentials` is a boolean only).
 */
export function toPublicDataSource(row: DataSourceRow) {
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		status: row.status,
		config: parseConfig(row.config),
		hasCredentials: Boolean(row.encryptedCredentials),
		lastError: row.lastError,
		lastTestedAt: row.lastTestedAt,
		lastIntrospectedAt: row.lastIntrospectedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export type PublicDataSource = ReturnType<typeof toPublicDataSource>;

/**
 * Replace a source's persisted catalog with a freshly introspected one. Always
 * called inside a transaction so a source and its catalog commit atomically
 * (no orphaned half-catalogs). Deletes the prior catalog first, then inserts.
 */
export async function persistCatalog(
	tx: Tx,
	dataSourceId: string,
	organizationId: string,
	catalog: Catalog,
): Promise<void> {
	await tx
		.delete(catalogTableTable)
		.where(eq(catalogTableTable.dataSourceId, dataSourceId));

	for (const table of catalog.tables) {
		const [inserted] = await tx
			.insert(catalogTableTable)
			.values({
				dataSourceId,
				organizationId,
				schemaName: table.schema,
				tableName: table.name,
				rowCountEstimate: table.rowCountEstimate ?? null,
				foreignKeys:
					table.foreignKeys.length > 0
						? JSON.stringify(table.foreignKeys)
						: null,
			})
			.returning({ id: catalogTableTable.id });

		if (!inserted || table.columns.length === 0) {
			continue;
		}

		await tx.insert(catalogColumnTable).values(
			table.columns.map((column) => ({
				catalogTableId: inserted.id,
				organizationId,
				columnName: column.name,
				dataType: column.dataType,
				normalizedType: column.normalizedType,
				isNullable: column.isNullable,
				isPrimaryKey: column.isPrimaryKey,
				ordinalPosition: column.ordinalPosition,
				distinctCount: column.distinctCount ?? null,
				sampleValues: column.sampleValues
					? JSON.stringify(column.sampleValues)
					: null,
			})),
		);
	}
}
