import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	gt,
	gte,
	ilike,
	inArray,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { adjustCredits as adjustCreditsLib } from "@/lib/billing/credits";
import {
	cancelSubscriptionAtPeriodEnd,
	cancelSubscriptionImmediately,
} from "@/lib/billing/subscriptions";
import {
	syncOrganizationOrders,
	syncOrganizationSubscriptions,
} from "@/lib/billing/sync";
import {
	creditBalanceTable,
	db,
	invitationTable,
	memberTable,
	organizationTable,
	subscriptionTable,
} from "@/lib/db";
import { LoggerFactory } from "@/lib/logger/factory";
import {
	adjustCreditsAdminSchema,
	cancelSubscriptionAdminSchema,
	deleteOrganizationAdminSchema,
	exportOrganizationsAdminSchema,
	listOrganizationsAdminSchema,
} from "@/schemas/admin-organization-schemas";
import { createTRPCRouter, protectedAdminProcedure } from "@/trpc/init";

const logger = LoggerFactory.getLogger("admin-organization");

export const adminOrganizationRouter = createTRPCRouter({
	list: protectedAdminProcedure
		.input(listOrganizationsAdminSchema)
		.query(async ({ input }) => {
			// Subquery to get the most relevant subscription for each organization
			// DISTINCT ON (organizationId) ensures we only join one subscription per org
			const relevantSubscriptions = db
				.selectDistinctOn([subscriptionTable.organizationId], {
					organizationId: subscriptionTable.organizationId,
					id: subscriptionTable.id,
					status: subscriptionTable.status,
					stripePriceId: subscriptionTable.stripePriceId,
					interval: subscriptionTable.interval,
					trialEnd: subscriptionTable.trialEnd,
					cancelAtPeriodEnd: subscriptionTable.cancelAtPeriodEnd,
				})
				.from(subscriptionTable)
				.orderBy(
					subscriptionTable.organizationId,
					desc(subscriptionTable.createdAt),
				)
				.as("relevant_subscriptions");

			// Subquery for member counts - efficient grouping
			const membersCountSubquery = db
				.select({
					organizationId: memberTable.organizationId,
					count: count().as("count"),
				})
				.from(memberTable)
				.groupBy(memberTable.organizationId)
				.as("members_counts");

			const conditions = [];

			if (input.query) {
				conditions.push(ilike(organizationTable.name, `%${input.query}%`));
			}

			if (
				input.filters?.membersCount &&
				input.filters.membersCount.length > 0
			) {
				const memberCountConditions = input.filters.membersCount
					.map((range) => {
						switch (range) {
							case "0":
								return or(
									sql`${membersCountSubquery.count} = 0`,
									sql`${membersCountSubquery.count} IS NULL`,
								);
							case "1-5":
								return and(
									gte(membersCountSubquery.count, 1),
									lte(membersCountSubquery.count, 5),
								);
							case "6-10":
								return and(
									gte(membersCountSubquery.count, 6),
									lte(membersCountSubquery.count, 10),
								);
							case "11+":
								return gt(membersCountSubquery.count, 10);
							default:
								return null;
						}
					})
					.filter((v): v is NonNullable<typeof v> => v !== null);

				if (memberCountConditions.length > 0) {
					conditions.push(or(...memberCountConditions));
				}
			}

			if (
				input.filters?.subscriptionStatus &&
				input.filters.subscriptionStatus.length > 0
			) {
				conditions.push(
					inArray(
						relevantSubscriptions.status,
						input.filters.subscriptionStatus,
					),
				);
			}

			if (
				input.filters?.subscriptionInterval &&
				input.filters.subscriptionInterval.length > 0
			) {
				conditions.push(
					inArray(
						relevantSubscriptions.interval,
						input.filters.subscriptionInterval,
					),
				);
			}

			if (
				input.filters?.balanceRange &&
				input.filters.balanceRange.length > 0
			) {
				const balanceConditions = input.filters.balanceRange
					.map((range) => {
						switch (range) {
							case "zero":
								return eq(creditBalanceTable.balance, 0);
							case "low":
								return and(
									gte(creditBalanceTable.balance, 1),
									lte(creditBalanceTable.balance, 1000),
								);
							case "medium":
								return and(
									gte(creditBalanceTable.balance, 1001),
									lte(creditBalanceTable.balance, 50000),
								);
							case "high":
								return gte(creditBalanceTable.balance, 50001);
							default:
								return null;
						}
					})
					.filter((v): v is NonNullable<typeof v> => v !== null);

				if (balanceConditions.length > 0) {
					conditions.push(or(...balanceConditions));
				}
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
									gte(organizationTable.createdAt, todayStart),
									lte(organizationTable.createdAt, todayEnd),
								);
							}
							case "this-week": {
								const weekStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									now.getDate() - now.getDay(),
								);
								return gte(organizationTable.createdAt, weekStart);
							}
							case "this-month": {
								const monthStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									1,
								);
								return gte(organizationTable.createdAt, monthStart);
							}
							case "older": {
								const monthAgo = new Date(
									now.getFullYear(),
									now.getMonth() - 1,
									now.getDate(),
								);
								return lte(organizationTable.createdAt, monthAgo);
							}
							default:
								return null;
						}
					})
					.filter((v): v is NonNullable<typeof v> => v !== null);

				if (dateConditions.length > 0) {
					conditions.push(or(...dateConditions));
				}
			}

			const whereCondition =
				conditions.length > 0 ? and(...conditions) : undefined;

			// Build sort order
			const sortDirection = input.sortOrder === "desc" ? desc : asc;

			const orderByClause =
				input.sortBy === "membersCount"
					? sortDirection(sql`COALESCE(${membersCountSubquery.count}, 0)`)
					: input.sortBy === "createdAt"
						? sortDirection(organizationTable.createdAt)
						: sortDirection(organizationTable.name);

			const organizations = await db
				.select({
					...getTableColumns(organizationTable),
					membersCount: sql<number>`COALESCE(${membersCountSubquery.count}, 0)`,
					pendingInvites: db
						.$count(
							invitationTable,
							and(
								eq(invitationTable.organizationId, organizationTable.id),
								eq(invitationTable.status, "pending"),
							),
						)
						.as("pendingInvites"),
					subscriptionStatus: relevantSubscriptions.status,
					subscriptionPlan: relevantSubscriptions.stripePriceId,
					subscriptionId: relevantSubscriptions.id,
					trialEnd: relevantSubscriptions.trialEnd,
					cancelAtPeriodEnd: relevantSubscriptions.cancelAtPeriodEnd,
					credits: creditBalanceTable.balance,
				})
				.from(organizationTable)
				.leftJoin(
					relevantSubscriptions,
					eq(relevantSubscriptions.organizationId, organizationTable.id),
				)
				.leftJoin(
					creditBalanceTable,
					eq(creditBalanceTable.organizationId, organizationTable.id),
				)
				.leftJoin(
					membersCountSubquery,
					eq(membersCountSubquery.organizationId, organizationTable.id),
				)
				.where(whereCondition)
				.limit(input.limit)
				.offset(input.offset)
				.orderBy(orderByClause);

			const total = await db
				.select({ count: count() })
				.from(organizationTable)
				.where(whereCondition);

			return { organizations, total: total[0]?.count || 0 };
		}),
	delete: protectedAdminProcedure
		.input(deleteOrganizationAdminSchema)
		.mutation(async ({ input }) => {
			await db
				.delete(organizationTable)
				.where(eq(organizationTable.id, input.id));
		}),
	exportSelectedToCsv: protectedAdminProcedure
		.input(exportOrganizationsAdminSchema)
		.mutation(async ({ input }) => {
			// Subquery to get the most relevant subscription for each organization
			const relevantSubscriptions = db
				.selectDistinctOn([subscriptionTable.organizationId], {
					organizationId: subscriptionTable.organizationId,
					status: subscriptionTable.status,
					stripePriceId: subscriptionTable.stripePriceId,
				})
				.from(subscriptionTable)
				.orderBy(
					subscriptionTable.organizationId,
					desc(subscriptionTable.createdAt),
				)
				.as("relevant_subscriptions");

			// Subquery for member counts
			const membersCountSubquery = db
				.select({
					organizationId: memberTable.organizationId,
					count: count().as("count"),
				})
				.from(memberTable)
				.groupBy(memberTable.organizationId)
				.as("members_counts");

			const organizations = await db
				.select({
					id: organizationTable.id,
					name: organizationTable.name,
					membersCount: sql<number>`COALESCE(${membersCountSubquery.count}, 0)`,
					pendingInvites: db
						.$count(
							invitationTable,
							and(
								eq(invitationTable.organizationId, organizationTable.id),
								eq(invitationTable.status, "pending"),
							),
						)
						.as("pendingInvites"),
					subscriptionStatus: relevantSubscriptions.status,
					subscriptionPlan: relevantSubscriptions.stripePriceId,
					credits: creditBalanceTable.balance,
					createdAt: organizationTable.createdAt,
					updatedAt: organizationTable.updatedAt,
				})
				.from(organizationTable)
				.leftJoin(
					relevantSubscriptions,
					eq(relevantSubscriptions.organizationId, organizationTable.id),
				)
				.leftJoin(
					creditBalanceTable,
					eq(creditBalanceTable.organizationId, organizationTable.id),
				)
				.leftJoin(
					membersCountSubquery,
					eq(membersCountSubquery.organizationId, organizationTable.id),
				)
				.where(inArray(organizationTable.id, input.organizationIds));

			const Papa = await import("papaparse");
			const csv = Papa.unparse(organizations);
			return csv;
		}),
	exportSelectedToExcel: protectedAdminProcedure
		.input(exportOrganizationsAdminSchema)
		.mutation(async ({ input }) => {
			// Subquery to get the most relevant subscription for each organization
			const relevantSubscriptions = db
				.selectDistinctOn([subscriptionTable.organizationId], {
					organizationId: subscriptionTable.organizationId,
					status: subscriptionTable.status,
					stripePriceId: subscriptionTable.stripePriceId,
				})
				.from(subscriptionTable)
				.orderBy(
					subscriptionTable.organizationId,
					desc(subscriptionTable.createdAt),
				)
				.as("relevant_subscriptions");

			// Subquery for member counts
			const membersCountSubquery = db
				.select({
					organizationId: memberTable.organizationId,
					count: count().as("count"),
				})
				.from(memberTable)
				.groupBy(memberTable.organizationId)
				.as("members_counts");

			const organizations = await db
				.select({
					id: organizationTable.id,
					name: organizationTable.name,
					membersCount: sql<number>`COALESCE(${membersCountSubquery.count}, 0)`,
					pendingInvites: db
						.$count(
							invitationTable,
							and(
								eq(invitationTable.organizationId, organizationTable.id),
								eq(invitationTable.status, "pending"),
							),
						)
						.as("pendingInvites"),
					subscriptionStatus: relevantSubscriptions.status,
					subscriptionPlan: relevantSubscriptions.stripePriceId,
					credits: creditBalanceTable.balance,
					createdAt: organizationTable.createdAt,
					updatedAt: organizationTable.updatedAt,
				})
				.from(organizationTable)
				.leftJoin(
					relevantSubscriptions,
					eq(relevantSubscriptions.organizationId, organizationTable.id),
				)
				.leftJoin(
					creditBalanceTable,
					eq(creditBalanceTable.organizationId, organizationTable.id),
				)
				.leftJoin(
					membersCountSubquery,
					eq(membersCountSubquery.organizationId, organizationTable.id),
				)
				.where(inArray(organizationTable.id, input.organizationIds));

			const ExcelJS = await import("exceljs");
			const workbook = new ExcelJS.Workbook();
			const worksheet = workbook.addWorksheet("Organizations");

			if (organizations.length > 0) {
				const columns = [
					{ header: "ID", key: "id", width: 40 },
					{ header: "Name", key: "name", width: 30 },
					{ header: "Members", key: "membersCount", width: 15 },
					{ header: "Pending Invites", key: "pendingInvites", width: 15 },
					{ header: "Plan", key: "subscriptionPlan", width: 20 },
					{ header: "Status", key: "subscriptionStatus", width: 15 },
					{ header: "Credits", key: "credits", width: 15 },
					{ header: "Created At", key: "createdAt", width: 25 },
					{ header: "Updated At", key: "updatedAt", width: 25 },
				];
				worksheet.columns = columns;
				for (const org of organizations) {
					worksheet.addRow(org);
				}
			}

			const buffer = await workbook.xlsx.writeBuffer();
			const base64 = Buffer.from(buffer).toString("base64");
			return base64;
		}),
	/**
	 * Sync selected organizations' subscriptions from Stripe
	 * Fetches fresh data from Stripe based on customer ID and updates local database
	 */
	syncFromStripe: protectedAdminProcedure
		.input(exportOrganizationsAdminSchema)
		.mutation(async ({ input, ctx }) => {
			logger.info(
				{
					organizationIds: input.organizationIds,
					adminId: ctx.user.id,
				},
				"Admin triggered manual sync from Stripe",
			);

			const [subscriptionResult, orderResult] = await Promise.all([
				syncOrganizationSubscriptions(input.organizationIds),
				syncOrganizationOrders(input.organizationIds),
			]);

			// Granular logging of results
			const subFailures = subscriptionResult.results.filter((r) => !r.success);
			const orderFailures = orderResult.results.filter((r) => !r.success);

			if (subFailures.length > 0 || orderFailures.length > 0) {
				logger.warn(
					{
						subFailures: subFailures.map((r) => ({
							id: r.organizationId,
							error: r.error,
						})),
						orderFailures: orderFailures.map((r) => ({
							id: r.organizationId,
							error: r.error,
						})),
					},
					"Some organizations failed to sync from Stripe",
				);
			}

			if (subscriptionResult.successful > 0 || orderResult.successful > 0) {
				logger.info(
					{
						subscriptionsSynced: subscriptionResult.successful,
						ordersSynced: orderResult.successful,
					},
					"Stripe sync completed successfully for some/all organizations",
				);
			}

			return {
				subscriptions: subscriptionResult,
				orders: orderResult,
			};
		}),

	/**
	 * Adjust organization credits (admin action)
	 */
	adjustCredits: protectedAdminProcedure
		.input(adjustCreditsAdminSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify organization exists
			const org = await db.query.organizationTable.findFirst({
				where: (t, { eq }) => eq(t.id, input.organizationId),
			});

			if (!org) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Organization not found",
				});
			}

			const transaction = await adjustCreditsLib({
				organizationId: input.organizationId,
				amount: input.amount,
				description: input.description,
				createdBy: ctx.user.id,
				metadata: {
					adjustedByAdmin: ctx.user.id,
					adjustedByEmail: ctx.user.email,
				},
			});

			return {
				success: true,
				newBalance: transaction.balanceAfter,
				transactionId: transaction.id,
			};
		}),

	/**
	 * Cancel an organization's subscription (admin action)
	 */
	cancelSubscription: protectedAdminProcedure
		.input(cancelSubscriptionAdminSchema)
		.mutation(async ({ input, ctx }) => {
			const { subscriptionId, immediate } = input;

			logger.info(
				{ subscriptionId, immediate, adminId: ctx.user.id },
				"Admin canceling subscription",
			);

			if (immediate) {
				await cancelSubscriptionImmediately(subscriptionId);
			} else {
				await cancelSubscriptionAtPeriodEnd(subscriptionId);
			}

			// The webhook will handle updating the local database

			return {
				success: true,
				immediate,
			};
		}),
});
