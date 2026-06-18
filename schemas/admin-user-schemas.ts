import { z } from "zod/v4";
import { appConfig } from "@/config/app.config";
import { UserRole } from "@/lib/db/schema/enums";

// Sortable fields for users
export const UserSortField = z.enum(["name", "email", "role", "createdAt"]);
export type UserSortField = z.infer<typeof UserSortField>;

// Query users (admin)
export const listUsersAdminSchema = z.object({
	query: z.coerce.string().max(200).optional(),
	limit: z.coerce
		.number()
		.min(1)
		.max(appConfig.pagination.maxLimit)
		.default(appConfig.pagination.defaultLimit),
	offset: z.coerce.number().min(0).default(0),
	sortBy: UserSortField.default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	filters: z
		.object({
			role: z.array(z.nativeEnum(UserRole)).optional(),
			emailVerified: z.array(z.enum(["verified", "pending"])).optional(),
			banned: z.array(z.enum(["active", "banned"])).optional(),
			createdAt: z
				.array(z.enum(["today", "this-week", "this-month", "older"]))
				.optional(),
		})
		.optional(),
});

// Export users (admin)
export const exportUsersAdminSchema = z.object({
	userIds: z.array(z.string().uuid()).min(1).max(1000), // Max 1000 users per export
});

// Ban user (admin)
export const banUserAdminSchema = z.object({
	userId: z.string().uuid(),
	reason: z.string().min(1, "Ban reason is required").max(1000),
	expiresAt: z.date().optional(),
});

// Unban user (admin)
export const unbanUserAdminSchema = z.object({
	userId: z.string().uuid(),
});

// Type exports
export type GetUsersAdminInput = z.infer<typeof listUsersAdminSchema>;
export type ExportUsersAdminInput = z.infer<typeof exportUsersAdminSchema>;
export type BanUserAdminInput = z.infer<typeof banUserAdminSchema>;
export type UnbanUserAdminInput = z.infer<typeof unbanUserAdminSchema>;
