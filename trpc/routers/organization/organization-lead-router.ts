import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	or,
	type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { leadTable } from "@/lib/db/schema/tables";
import {
	bulkDeleteLeadsSchema,
	bulkUpdateLeadsStatusSchema,
	createLeadSchema,
	deleteLeadSchema,
	exportLeadsSchema,
	listLeadsSchema,
	updateLeadSchema,
} from "@/schemas/organization-lead-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationLeadRouter = createTRPCRouter({
	list: protectedOrganizationProcedure
		.input(listLeadsSchema)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(leadTable.organizationId, ctx.organization.id)];

			if (input.query) {
				conditions.push(
					or(
						ilike(leadTable.firstName, `%${input.query}%`),
						ilike(leadTable.lastName, `%${input.query}%`),
						ilike(leadTable.email, `%${input.query}%`),
						ilike(leadTable.company, `%${input.query}%`),
					)!,
				);
			}

			if (input.filters?.status && input.filters.status.length > 0) {
				conditions.push(inArray(leadTable.status, input.filters.status));
			}

			if (input.filters?.source && input.filters.source.length > 0) {
				conditions.push(inArray(leadTable.source, input.filters.source));
			}

			if (input.filters?.createdAt && input.filters.createdAt.length > 0) {
				const dateConditions = input.filters.createdAt
					.map((range) => {
						const now = new Date();
						switch (range) {
							case "today": {
								const todayStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									now.getDate(),
								);
								const todayEnd = new Date(
									now.getFullYear(),
									now.getMonth(),
									now.getDate() + 1,
								);
								return and(
									gte(leadTable.createdAt, todayStart),
									lte(leadTable.createdAt, todayEnd),
								);
							}
							case "this-week": {
								const weekStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									now.getDate() - now.getDay(),
								);
								return gte(leadTable.createdAt, weekStart);
							}
							case "this-month": {
								const monthStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									1,
								);
								return gte(leadTable.createdAt, monthStart);
							}
							case "older": {
								const monthAgo = new Date(
									now.getFullYear(),
									now.getMonth() - 1,
									now.getDate(),
								);
								return lte(leadTable.createdAt, monthAgo);
							}
							default:
								return null;
						}
					})
					.filter((v): v is NonNullable<typeof v> => v !== null);
				if (dateConditions.length > 0) {
					conditions.push(or(...dateConditions)!);
				}
			}

			const whereCondition = and(...conditions);

			// Build sort order
			const sortDirection = input.sortOrder === "desc" ? desc : asc;
			let orderByColumn: SQL;
			switch (input.sortBy) {
				case "name":
					orderByColumn = sortDirection(leadTable.firstName);
					break;
				case "company":
					orderByColumn = sortDirection(leadTable.company);
					break;
				case "email":
					orderByColumn = sortDirection(leadTable.email);
					break;
				case "status":
					orderByColumn = sortDirection(leadTable.status);
					break;
				case "source":
					orderByColumn = sortDirection(leadTable.source);
					break;
				case "estimatedValue":
					orderByColumn = sortDirection(leadTable.estimatedValue);
					break;
				default:
					orderByColumn = sortDirection(leadTable.createdAt);
					break;
			}

			// Run leads and count queries in parallel
			const [leads, countResult] = await Promise.all([
				db.query.leadTable.findMany({
					where: whereCondition,
					limit: input.limit,
					offset: input.offset,
					orderBy: orderByColumn,
					with: {
						assignedTo: {
							columns: {
								id: true,
								name: true,
								email: true,
								image: true,
							},
						},
					},
				}),
				db.select({ count: count() }).from(leadTable).where(whereCondition),
			]);

			return { leads, total: countResult[0]?.count ?? 0 };
		}),

	get: protectedOrganizationProcedure
		.input(deleteLeadSchema)
		.query(async ({ ctx, input }) => {
			const lead = await db.query.leadTable.findFirst({
				where: and(
					eq(leadTable.id, input.id),
					eq(leadTable.organizationId, ctx.organization.id),
				),
				with: {
					assignedTo: {
						columns: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
			});

			if (!lead) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lead not found",
				});
			}

			return lead;
		}),

	create: protectedOrganizationProcedure
		.input(createLeadSchema)
		.mutation(async ({ ctx, input }) => {
			const [lead] = await db
				.insert(leadTable)
				.values({
					...input,
					organizationId: ctx.organization.id,
				})
				.returning();

			return lead;
		}),

	update: protectedOrganizationProcedure
		.input(updateLeadSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;

			// Use atomic update with organization check in WHERE clause
			// This prevents TOCTOU race conditions by combining check and update
			const [updatedLead] = await db
				.update(leadTable)
				.set(data)
				.where(
					and(
						eq(leadTable.id, id),
						eq(leadTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updatedLead) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lead not found",
				});
			}

			return updatedLead;
		}),

	delete: protectedOrganizationProcedure
		.input(deleteLeadSchema)
		.mutation(async ({ ctx, input }) => {
			// Use atomic delete with organization check in WHERE clause
			// This prevents TOCTOU race conditions by combining check and delete
			const [deletedLead] = await db
				.delete(leadTable)
				.where(
					and(
						eq(leadTable.id, input.id),
						eq(leadTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!deletedLead) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lead not found",
				});
			}

			return { success: true };
		}),

	bulkDelete: protectedOrganizationProcedure
		.input(bulkDeleteLeadsSchema)
		.mutation(async ({ ctx, input }) => {
			// Use returning() to get actual deleted count instead of assuming all IDs existed
			const deleted = await db
				.delete(leadTable)
				.where(
					and(
						inArray(leadTable.id, input.ids),
						eq(leadTable.organizationId, ctx.organization.id),
					),
				)
				.returning({ id: leadTable.id });

			return { success: true, count: deleted.length };
		}),

	bulkUpdateStatus: protectedOrganizationProcedure
		.input(bulkUpdateLeadsStatusSchema)
		.mutation(async ({ ctx, input }) => {
			// Use returning() to get actual updated count instead of assuming all IDs existed
			const updated = await db
				.update(leadTable)
				.set({ status: input.status })
				.where(
					and(
						inArray(leadTable.id, input.ids),
						eq(leadTable.organizationId, ctx.organization.id),
					),
				)
				.returning({ id: leadTable.id });

			return { success: true, count: updated.length };
		}),

	exportSelectedToCsv: protectedOrganizationProcedure
		.input(exportLeadsSchema)
		.mutation(async ({ ctx, input }) => {
			// Explicitly select only the columns we want to export
			// Excludes: organizationId (internal), assignedToId (internal reference)
			const leads = await db
				.select({
					id: leadTable.id,
					firstName: leadTable.firstName,
					lastName: leadTable.lastName,
					email: leadTable.email,
					phone: leadTable.phone,
					company: leadTable.company,
					jobTitle: leadTable.jobTitle,
					status: leadTable.status,
					source: leadTable.source,
					estimatedValue: leadTable.estimatedValue,
					notes: leadTable.notes,
					createdAt: leadTable.createdAt,
					updatedAt: leadTable.updatedAt,
				})
				.from(leadTable)
				.where(
					and(
						inArray(leadTable.id, input.leadIds),
						eq(leadTable.organizationId, ctx.organization.id),
					),
				);
			const Papa = await import("papaparse");
			const csv = Papa.unparse(leads);
			return csv;
		}),

	exportSelectedToExcel: protectedOrganizationProcedure
		.input(exportLeadsSchema)
		.mutation(async ({ ctx, input }) => {
			// Explicitly select only the columns we want to export
			// Excludes: organizationId (internal), assignedToId (internal reference)
			const leads = await db
				.select({
					id: leadTable.id,
					firstName: leadTable.firstName,
					lastName: leadTable.lastName,
					email: leadTable.email,
					phone: leadTable.phone,
					company: leadTable.company,
					jobTitle: leadTable.jobTitle,
					status: leadTable.status,
					source: leadTable.source,
					estimatedValue: leadTable.estimatedValue,
					notes: leadTable.notes,
					createdAt: leadTable.createdAt,
					updatedAt: leadTable.updatedAt,
				})
				.from(leadTable)
				.where(
					and(
						inArray(leadTable.id, input.leadIds),
						eq(leadTable.organizationId, ctx.organization.id),
					),
				);
			const ExcelJS = await import("exceljs");
			const workbook = new ExcelJS.Workbook();
			const worksheet = workbook.addWorksheet("Leads");

			if (leads.length > 0) {
				const columns = [
					{ header: "ID", key: "id", width: 40 },
					{ header: "First Name", key: "firstName", width: 20 },
					{ header: "Last Name", key: "lastName", width: 20 },
					{ header: "Email", key: "email", width: 30 },
					{ header: "Phone", key: "phone", width: 20 },
					{ header: "Company", key: "company", width: 25 },
					{ header: "Job Title", key: "jobTitle", width: 25 },
					{ header: "Status", key: "status", width: 15 },
					{ header: "Source", key: "source", width: 15 },
					{ header: "Estimated Value", key: "estimatedValue", width: 18 },
					{ header: "Notes", key: "notes", width: 40 },
					{ header: "Created At", key: "createdAt", width: 25 },
					{ header: "Updated At", key: "updatedAt", width: 25 },
				];
				worksheet.columns = columns;
				for (const lead of leads) {
					worksheet.addRow(lead);
				}
			}

			const buffer = await workbook.xlsx.writeBuffer();
			const base64 = Buffer.from(buffer).toString("base64");
			return base64;
		}),
});
