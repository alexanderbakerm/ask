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
	isNull,
	lte,
	or,
	type SQL,
} from "drizzle-orm";
import { db, userTable } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
	banUserAdminSchema,
	exportUsersAdminSchema,
	listUsersAdminSchema,
	unbanUserAdminSchema,
} from "@/schemas/admin-user-schemas";
import { createTRPCRouter, protectedAdminProcedure } from "@/trpc/init";

export const adminUserRouter = createTRPCRouter({
	list: protectedAdminProcedure
		.input(listUsersAdminSchema)
		.query(async ({ input }) => {
			const conditions = [];
			if (input.query) {
				conditions.push(
					or(
						ilike(userTable.name, `%${input.query}%`),
						ilike(userTable.email, `%${input.query}%`),
					),
				);
			}
			if (input.filters?.role && input.filters.role.length > 0) {
				conditions.push(inArray(userTable.role, input.filters.role));
			}
			if (
				input.filters?.emailVerified &&
				input.filters.emailVerified.length > 0
			) {
				const emailVerifiedConditions = input.filters.emailVerified
					.map((status) => {
						if (status === "verified") {
							return eq(userTable.emailVerified, true);
						}
						if (status === "pending") {
							return eq(userTable.emailVerified, false);
						}
						return null;
					})
					.filter((v): v is NonNullable<typeof v> => v !== null);
				if (emailVerifiedConditions.length > 0) {
					conditions.push(or(...emailVerifiedConditions));
				}
			}
			if (input.filters?.banned && input.filters.banned.length > 0) {
				const bannedConditions = input.filters.banned
					.map((status) => {
						if (status === "banned") {
							return eq(userTable.banned, true);
						}
						if (status === "active") {
							return or(eq(userTable.banned, false), isNull(userTable.banned));
						}
						return null;
					})
					.filter((v): v is NonNullable<typeof v> => v !== null);
				if (bannedConditions.length > 0) {
					conditions.push(or(...bannedConditions));
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
									gte(userTable.createdAt, todayStart),
									lte(userTable.createdAt, todayEnd),
								);
							}
							case "this-week": {
								const weekStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									now.getDate() - now.getDay(),
								);
								return gte(userTable.createdAt, weekStart);
							}
							case "this-month": {
								const monthStart = new Date(
									now.getFullYear(),
									now.getMonth(),
									1,
								);
								return gte(userTable.createdAt, monthStart);
							}
							case "older": {
								const monthAgo = new Date(
									now.getFullYear(),
									now.getMonth() - 1,
									now.getDate(),
								);
								return lte(userTable.createdAt, monthAgo);
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
			let orderByColumn: SQL;
			switch (input.sortBy) {
				case "name":
					orderByColumn = sortDirection(userTable.name);
					break;
				case "email":
					orderByColumn = sortDirection(userTable.email);
					break;
				case "role":
					orderByColumn = sortDirection(userTable.role);
					break;
				default:
					orderByColumn = sortDirection(userTable.createdAt);
					break;
			}

			const users = await db.query.userTable.findMany({
				where: whereCondition,
				limit: input.limit,
				offset: input.offset,
				orderBy: orderByColumn,
			});

			const total = await db
				.select({ count: count() })
				.from(userTable)
				.where(whereCondition);

			return { users, total: total[0]?.count || 0 };
		}),
	exportSelectedToCsv: protectedAdminProcedure
		.input(exportUsersAdminSchema)
		.mutation(async ({ input }) => {
			const users = await db
				.select({
					id: userTable.id,
					name: userTable.name,
					email: userTable.email,
					emailVerified: userTable.emailVerified,
					role: userTable.role,
					banned: userTable.banned,
					onboardingComplete: userTable.onboardingComplete,
					twoFactorEnabled: userTable.twoFactorEnabled,
					createdAt: userTable.createdAt,
					updatedAt: userTable.updatedAt,
				})
				.from(userTable)
				.where(inArray(userTable.id, input.userIds));
			const Papa = await import("papaparse");
			const csv = Papa.unparse(users);
			return csv;
		}),
	exportSelectedToExcel: protectedAdminProcedure
		.input(exportUsersAdminSchema)
		.mutation(async ({ input }) => {
			const users = await db
				.select({
					id: userTable.id,
					name: userTable.name,
					email: userTable.email,
					emailVerified: userTable.emailVerified,
					role: userTable.role,
					banned: userTable.banned,
					onboardingComplete: userTable.onboardingComplete,
					twoFactorEnabled: userTable.twoFactorEnabled,
					createdAt: userTable.createdAt,
					updatedAt: userTable.updatedAt,
				})
				.from(userTable)
				.where(inArray(userTable.id, input.userIds));
			const ExcelJS = await import("exceljs");
			const workbook = new ExcelJS.Workbook();
			const worksheet = workbook.addWorksheet("Users");

			if (users.length > 0) {
				const columns = [
					{ header: "ID", key: "id", width: 40 },
					{ header: "Name", key: "name", width: 25 },
					{ header: "Email", key: "email", width: 30 },
					{ header: "Email Verified", key: "emailVerified", width: 15 },
					{ header: "Role", key: "role", width: 15 },
					{ header: "Banned", key: "banned", width: 10 },
					{
						header: "Onboarding Complete",
						key: "onboardingComplete",
						width: 20,
					},
					{ header: "2FA Enabled", key: "twoFactorEnabled", width: 15 },
					{ header: "Created At", key: "createdAt", width: 25 },
					{ header: "Updated At", key: "updatedAt", width: 25 },
				];
				worksheet.columns = columns;
				for (const user of users) {
					worksheet.addRow(user);
				}
			}

			const buffer = await workbook.xlsx.writeBuffer();
			const base64 = Buffer.from(buffer).toString("base64");
			return base64;
		}),
	banUser: protectedAdminProcedure
		.input(banUserAdminSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user exists
			const targetUser = await db.query.userTable.findFirst({
				where: eq(userTable.id, input.userId),
			});

			if (!targetUser) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Prevent banning yourself
			if (targetUser.id === ctx.user.id) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot ban yourself",
				});
			}

			// Check if user is already banned
			if (targetUser.banned) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "User is already banned",
				});
			}

			// Update user with ban information
			await db
				.update(userTable)
				.set({
					banned: true,
					banReason: input.reason,
					banExpires: input.expiresAt || null,
				})
				.where(eq(userTable.id, input.userId));

			// Log ban operation for monitoring/debugging
			logger.info(
				{
					action: "user_banned",
					targetUserId: input.userId,
					targetUserEmail: targetUser.email,
					adminUserId: ctx.user.id,
					adminUserEmail: ctx.user.email,
					reason: input.reason,
					expiresAt: input.expiresAt || null,
				},
				"Admin banned user",
			);
		}),
	unbanUser: protectedAdminProcedure
		.input(unbanUserAdminSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user exists
			const targetUser = await db.query.userTable.findFirst({
				where: eq(userTable.id, input.userId),
			});

			if (!targetUser) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Check if user is not banned
			if (!targetUser.banned) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "User is not banned",
				});
			}

			// Update user to remove ban
			await db
				.update(userTable)
				.set({
					banned: false,
					banReason: null,
					banExpires: null,
				})
				.where(eq(userTable.id, input.userId));

			// Log unban operation for monitoring/debugging
			logger.info(
				{
					action: "user_unbanned",
					targetUserId: input.userId,
					targetUserEmail: targetUser.email,
					adminUserId: ctx.user.id,
					adminUserEmail: ctx.user.email,
					previousBanReason: targetUser.banReason,
				},
				"Admin unbanned user",
			);
		}),
});
