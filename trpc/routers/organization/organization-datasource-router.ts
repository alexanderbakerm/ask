import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { encryptJson } from "@/lib/crypto/secrets";
import { type CsvLoadResult, dropUploadsSchema, loadCsvSource } from "@/lib/datasources/csv-loader";
import { sanitizeDbError } from "@/lib/datasources/errors";
import { createConnector } from "@/lib/datasources/factory";
import type { PostgresConnectionParams } from "@/lib/datasources/postgres-connector";
import {
	buildConnectorParams,
	type DataSourceRow,
	parseConfig,
	persistCatalog,
	serializeConfig,
	toPublicDataSource,
} from "@/lib/datasources/service";
import type { Catalog, DataSourceConnector } from "@/lib/datasources/types";
import { db } from "@/lib/db";
import { catalogTableTable, dataSourceTable } from "@/lib/db/schema";
import { DataSourceStatus, DataSourceType } from "@/lib/db/schema/enums";
import { logger } from "@/lib/logger";
import {
	createDataSourceSchema,
	dataSourceIdSchema,
	importCsvSchema,
	updateDataSourceSchema,
} from "@/schemas/organization-datasource-schemas";
import {
	createTRPCRouter,
	protectedOrganizationAdminProcedure,
	protectedOrganizationProcedure,
} from "@/trpc/init";

async function getSourceRowOrThrow(
	id: string,
	organizationId: string,
): Promise<DataSourceRow> {
	const row = await db.query.dataSourceTable.findFirst({
		where: and(
			eq(dataSourceTable.id, id),
			eq(dataSourceTable.organizationId, organizationId),
		),
	});
	if (!row) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Data source not found",
		});
	}
	return row;
}

/**
 * Connect, test, and introspect — all connector I/O happens here, OUTSIDE any
 * DB transaction (never hold an app-DB tx open across external network I/O).
 * Introspection is allowed to fail without blocking: we still persist the
 * source, marked `error`, so the user can retry via `reintrospect`.
 */
async function probe(connector: DataSourceConnector): Promise<{
	status: DataSourceStatus;
	lastError: string | null;
	catalog: Catalog | null;
}> {
	try {
		const test = await connector.testConnection();
		if (!test.ok) {
			return {
				status: DataSourceStatus.error,
				lastError: test.error ?? "Connection failed",
				catalog: null,
			};
		}
		try {
			const catalog = await connector.introspect();
			return { status: DataSourceStatus.connected, lastError: null, catalog };
		} catch (error) {
			logger.warn(
				{ error: sanitizeDbError(error) },
				"AskBI introspection failed during probe",
			);
			return {
				status: DataSourceStatus.error,
				lastError:
					"Connected, but schema introspection failed. Use Reintrospect to retry.",
				catalog: null,
			};
		}
	} finally {
		await connector.close();
	}
}

export const organizationDataSourceRouter = createTRPCRouter({
	// ---- Read / use: any member ----

	list: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const rows = await db.query.dataSourceTable.findMany({
			where: eq(dataSourceTable.organizationId, ctx.organization.id),
			orderBy: desc(dataSourceTable.createdAt),
		});
		return { dataSources: rows.map(toPublicDataSource) };
	}),

	get: protectedOrganizationProcedure
		.input(dataSourceIdSchema)
		.query(async ({ ctx, input }) => {
			const row = await getSourceRowOrThrow(input.id, ctx.organization.id);
			return { dataSource: toPublicDataSource(row) };
		}),

	// The persisted catalog for display / grounding. Members may read it.
	getCatalog: protectedOrganizationProcedure
		.input(dataSourceIdSchema)
		.query(async ({ ctx, input }) => {
			const row = await getSourceRowOrThrow(input.id, ctx.organization.id);
			const tables = await db.query.catalogTableTable.findMany({
				where: eq(catalogTableTable.dataSourceId, row.id),
				orderBy: [
					asc(catalogTableTable.schemaName),
					asc(catalogTableTable.tableName),
				],
				with: { columns: true },
			});

			return {
				dataSource: toPublicDataSource(row),
				catalog: {
					tables: tables.map((table) => ({
						schema: table.schemaName,
						name: table.tableName,
						description: table.description,
						rowCountEstimate: table.rowCountEstimate,
						foreignKeys: table.foreignKeys
							? (JSON.parse(table.foreignKeys) as unknown)
							: [],
						columns: [...table.columns]
							.sort(
								(a, b) => (a.ordinalPosition ?? 0) - (b.ordinalPosition ?? 0),
							)
							.map((column) => ({
								name: column.columnName,
								dataType: column.dataType,
								normalizedType: column.normalizedType,
								isNullable: column.isNullable,
								isPrimaryKey: column.isPrimaryKey,
								description: column.description,
								// distinctCount is sample-based / approximate by design.
								distinctCount: column.distinctCount,
								sampleValues: column.sampleValues
									? (JSON.parse(column.sampleValues) as unknown)
									: null,
							})),
					})),
				},
			};
		}),

	// ---- Management: owner / admin only ----

	create: protectedOrganizationAdminProcedure
		.input(createDataSourceSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const c = input.connection;
			const params: PostgresConnectionParams = {
				host: c.host,
				port: c.port,
				database: c.database,
				user: c.user,
				password: c.password ?? "",
				ssl: c.ssl,
				schemas: c.schemas,
			};

			const { status, lastError, catalog } = await probe(
				createConnector(input.type, params),
			);

			const now = new Date();
			const config = serializeConfig({
				host: c.host,
				port: c.port,
				database: c.database,
				user: c.user,
				ssl: c.ssl,
				schemas: c.schemas,
			});
			const encryptedCredentials = encryptJson({ password: params.password });

			const created = await db.transaction(async (tx) => {
				const [row] = await tx
					.insert(dataSourceTable)
					.values({
						organizationId,
						name: input.name,
						type: input.type,
						status,
						config,
						encryptedCredentials,
						lastError,
						createdBy: ctx.user.id,
						lastTestedAt: now,
						lastIntrospectedAt: catalog ? now : null,
					})
					.returning();
				if (!row) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create data source",
					});
				}
				if (catalog) {
					await persistCatalog(tx, row.id, organizationId, catalog);
				}
				return row;
			});

			return { dataSource: toPublicDataSource(created) };
		}),

	// Import a CSV: load it into the uploads database (admin write), then
	// register + introspect it like any Postgres source (read-only role). The
	// auto-dashboard and chat work on it immediately.
	importCsv: protectedOrganizationAdminProcedure
		.input(importCsvSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;

			let loaded: CsvLoadResult;
			try {
				loaded = await loadCsvSource(input.csv, input.hasHeader);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error ? error.message : "Could not import the CSV",
				});
			}

			const params: PostgresConnectionParams = {
				host: loaded.config.host,
				port: loaded.config.port,
				database: loaded.config.database,
				user: loaded.config.user,
				password: loaded.secrets.password,
				ssl: loaded.config.ssl,
				schemas: loaded.config.schemas,
			};
			const { status, lastError, catalog } = await probe(
				createConnector(DataSourceType.csv, params),
			);

			const now = new Date();
			const config = serializeConfig(loaded.config);
			const encryptedCredentials = encryptJson({
				password: loaded.secrets.password,
			});

			const created = await db.transaction(async (tx) => {
				const [row] = await tx
					.insert(dataSourceTable)
					.values({
						organizationId,
						name: input.name,
						type: DataSourceType.csv,
						status,
						config,
						encryptedCredentials,
						lastError,
						createdBy: ctx.user.id,
						lastTestedAt: now,
						lastIntrospectedAt: catalog ? now : null,
					})
					.returning();
				if (!row) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create data source",
					});
				}
				if (catalog) {
					await persistCatalog(tx, row.id, organizationId, catalog);
				}
				return row;
			});

			return {
				dataSource: toPublicDataSource(created),
				rowCount: loaded.rowCount,
				truncated: loaded.truncated,
			};
		}),

	update: protectedOrganizationAdminProcedure
		.input(updateDataSourceSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const existing = await getSourceRowOrThrow(input.id, organizationId);
			const where = and(
				eq(dataSourceTable.id, input.id),
				eq(dataSourceTable.organizationId, organizationId),
			);

			// Name-only update: no connector I/O.
			if (!input.connection) {
				const [row] = await db
					.update(dataSourceTable)
					.set({ name: input.name ?? existing.name })
					.where(where)
					.returning();
				if (!row) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to update data source",
					});
				}
				return { dataSource: toPublicDataSource(row) };
			}

			// Connection change: reuse the existing password if none supplied (rotate
			// only when a new one is provided).
			const conn = input.connection;
			const existingPassword = buildConnectorParams(existing).password;
			const password =
				conn.password && conn.password.length > 0
					? conn.password
					: existingPassword;

			const params: PostgresConnectionParams = {
				host: conn.host,
				port: conn.port,
				database: conn.database,
				user: conn.user,
				password,
				ssl: conn.ssl,
				schemas: conn.schemas,
			};

			const { status, lastError, catalog } = await probe(
				createConnector(existing.type, params),
			);

			const now = new Date();
			const config = serializeConfig({
				host: conn.host,
				port: conn.port,
				database: conn.database,
				user: conn.user,
				ssl: conn.ssl,
				schemas: conn.schemas,
			});
			const encryptedCredentials = encryptJson({ password });

			const updated = await db.transaction(async (tx) => {
				const [row] = await tx
					.update(dataSourceTable)
					.set({
						name: input.name ?? existing.name,
						status,
						config,
						encryptedCredentials,
						lastError,
						lastTestedAt: now,
						lastIntrospectedAt: catalog ? now : existing.lastIntrospectedAt,
					})
					.where(where)
					.returning();
				if (!row) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to update data source",
					});
				}
				// Only replace the catalog when we successfully re-introspected.
				if (catalog) {
					await persistCatalog(tx, row.id, organizationId, catalog);
				}
				return row;
			});

			return { dataSource: toPublicDataSource(updated) };
		}),

	delete: protectedOrganizationAdminProcedure
		.input(dataSourceIdSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const row = await getSourceRowOrThrow(input.id, organizationId);
			await db
				.delete(dataSourceTable)
				.where(
					and(
						eq(dataSourceTable.id, input.id),
						eq(dataSourceTable.organizationId, organizationId),
					),
				);
			// Imported CSVs own their data — drop the uploads schema (best-effort).
			if (row.type === DataSourceType.csv) {
				const schema = parseConfig(row.config).schemas[0];
				if (schema) await dropUploadsSchema(schema);
			}
			return { success: true };
		}),

	test: protectedOrganizationAdminProcedure
		.input(dataSourceIdSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const row = await getSourceRowOrThrow(input.id, organizationId);

			const connector = createConnector(row.type, buildConnectorParams(row));
			let result: Awaited<ReturnType<DataSourceConnector["testConnection"]>>;
			try {
				result = await connector.testConnection();
			} finally {
				await connector.close();
			}

			let status = row.status;
			if (!result.ok) {
				status = DataSourceStatus.error;
			} else if (row.lastIntrospectedAt) {
				status = DataSourceStatus.connected;
			}

			await db
				.update(dataSourceTable)
				.set({
					status,
					lastTestedAt: new Date(),
					lastError: result.ok ? null : (result.error ?? "Connection failed"),
				})
				.where(
					and(
						eq(dataSourceTable.id, row.id),
						eq(dataSourceTable.organizationId, organizationId),
					),
				);

			return {
				ok: result.ok,
				error: result.ok ? null : (result.error ?? "Connection failed"),
				latencyMs: result.latencyMs ?? null,
				serverVersion: result.ok ? (result.serverVersion ?? null) : null,
			};
		}),

	reintrospect: protectedOrganizationAdminProcedure
		.input(dataSourceIdSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const row = await getSourceRowOrThrow(input.id, organizationId);
			const where = and(
				eq(dataSourceTable.id, row.id),
				eq(dataSourceTable.organizationId, organizationId),
			);

			const connector = createConnector(row.type, buildConnectorParams(row));
			let catalog: Catalog;
			try {
				catalog = await connector.introspect();
			} catch (error) {
				// Mark the error but keep the existing catalog (don't wipe on failure).
				await db
					.update(dataSourceTable)
					.set({
						status: DataSourceStatus.error,
						lastError:
							"Schema introspection failed. Check the connection and try again.",
						lastTestedAt: new Date(),
					})
					.where(where);
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: sanitizeDbError(error),
				});
			} finally {
				await connector.close();
			}

			const now = new Date();
			const updated = await db.transaction(async (tx) => {
				await persistCatalog(tx, row.id, organizationId, catalog);
				const [r] = await tx
					.update(dataSourceTable)
					.set({
						status: DataSourceStatus.connected,
						lastError: null,
						lastTestedAt: now,
						lastIntrospectedAt: now,
					})
					.where(where)
					.returning();
				if (!r) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to update data source",
					});
				}
				return r;
			});

			return { dataSource: toPublicDataSource(updated) };
		}),
});
