import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { runSavedQuery } from "@/lib/ai/askbi/saved-query";
import { db } from "@/lib/db";
import { dataSourceTable, savedQueryTable } from "@/lib/db/schema";
import {
	renameSavedQuerySchema,
	savedQueryIdSchema,
	saveQuerySchema,
} from "@/schemas/organization-savedquery-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

type SavedQueryRow = typeof savedQueryTable.$inferSelect;

function vizTypeOf(vizSpec: string | null): string | null {
	if (!vizSpec) return null;
	try {
		const parsed = JSON.parse(vizSpec) as { type?: unknown };
		return typeof parsed.type === "string" ? parsed.type : null;
	} catch {
		return null;
	}
}

// Client-safe projection (no SQL/result data in the list view).
function toPublic(row: SavedQueryRow) {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		dataSourceId: row.dataSourceId,
		vizType: vizTypeOf(row.vizSpec),
		createdAt: row.createdAt,
	};
}

/**
 * Saved queries are per-user-private for the MVP: every read/write is scoped to
 * the caller (organization + their own userId), so visibility and
 * rename/delete are inherently owner-only. Org-sharing is a clean Phase 2 add.
 */
export const organizationSavedQueryRouter = createTRPCRouter({
	list: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const rows = await db.query.savedQueryTable.findMany({
			where: and(
				eq(savedQueryTable.organizationId, ctx.organization.id),
				eq(savedQueryTable.userId, ctx.user.id),
			),
			orderBy: desc(savedQueryTable.createdAt),
		});
		return { savedQueries: rows.map(toPublic) };
	}),

	save: protectedOrganizationProcedure
		.input(saveQuerySchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const source = await db.query.dataSourceTable.findFirst({
				where: and(
					eq(dataSourceTable.id, input.dataSourceId),
					eq(dataSourceTable.organizationId, organizationId),
				),
			});
			if (!source) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Data source not found",
				});
			}

			const vizSpec = JSON.stringify({
				type: input.vizType ?? null,
				intent: input.intent ?? null,
				columns: input.columns ?? [],
			});

			const [row] = await db
				.insert(savedQueryTable)
				.values({
					organizationId,
					dataSourceId: input.dataSourceId,
					userId: ctx.user.id,
					name: input.name,
					question: input.question ?? null,
					sql: input.sql,
					vizSpec,
				})
				.returning();
			if (!row) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save query",
				});
			}
			return { savedQuery: toPublic(row) };
		}),

	// Re-execute on open for fresh data, re-validating through the chokepoint.
	open: protectedOrganizationProcedure
		.input(savedQueryIdSchema)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.organization.id;
			const saved = await db.query.savedQueryTable.findFirst({
				where: and(
					eq(savedQueryTable.id, input.id),
					eq(savedQueryTable.organizationId, organizationId),
					eq(savedQueryTable.userId, ctx.user.id),
				),
			});
			if (!saved) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Saved query not found",
				});
			}

			const source = saved.dataSourceId
				? await db.query.dataSourceTable.findFirst({
						where: and(
							eq(dataSourceTable.id, saved.dataSourceId),
							eq(dataSourceTable.organizationId, organizationId),
						),
					})
				: undefined;
			if (!source) {
				return {
					ok: false as const,
					status: "validation_rejected" as const,
					error: "The data source for this saved query is no longer connected.",
				};
			}

			return runSavedQuery(saved, source);
		}),

	rename: protectedOrganizationProcedure
		.input(renameSavedQuerySchema)
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.update(savedQueryTable)
				.set({ name: input.name })
				.where(
					and(
						eq(savedQueryTable.id, input.id),
						eq(savedQueryTable.organizationId, ctx.organization.id),
						eq(savedQueryTable.userId, ctx.user.id),
					),
				)
				.returning();
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Saved query not found",
				});
			}
			return { savedQuery: toPublic(row) };
		}),

	delete: protectedOrganizationProcedure
		.input(savedQueryIdSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.savedQueryTable.findFirst({
				where: and(
					eq(savedQueryTable.id, input.id),
					eq(savedQueryTable.organizationId, ctx.organization.id),
					eq(savedQueryTable.userId, ctx.user.id),
				),
			});
			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Saved query not found",
				});
			}
			await db
				.delete(savedQueryTable)
				.where(
					and(
						eq(savedQueryTable.id, input.id),
						eq(savedQueryTable.organizationId, ctx.organization.id),
						eq(savedQueryTable.userId, ctx.user.id),
					),
				);
			return { success: true };
		}),
});
