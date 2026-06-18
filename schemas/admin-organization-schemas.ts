import { z } from "zod/v4";
import { appConfig } from "@/config/app.config";

// Sortable fields for organizations
export const OrganizationSortField = z.enum([
	"name",
	"membersCount",
	"createdAt",
]);
export type OrganizationSortField = z.infer<typeof OrganizationSortField>;

// Query organizations (admin)
export const listOrganizationsAdminSchema = z.object({
	query: z.coerce.string().max(200).optional(),
	limit: z.coerce
		.number()
		.min(1)
		.max(appConfig.pagination.maxLimit)
		.default(appConfig.pagination.defaultLimit),
	offset: z.coerce.number().min(0).default(0),
	sortBy: OrganizationSortField.default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	filters: z
		.object({
			membersCount: z.array(z.enum(["0", "1-5", "6-10", "11+"])).optional(),
			createdAt: z
				.array(z.enum(["today", "this-week", "this-month", "older"]))
				.optional(),
			subscriptionStatus: z
				.array(
					z.enum([
						"active",
						"trialing",
						"canceled",
						"past_due",
						"paused",
						"incomplete",
						"incomplete_expired",
						"unpaid",
					]),
				)
				.optional(),
			subscriptionInterval: z.array(z.enum(["month", "year"])).optional(),
			balanceRange: z
				.array(z.enum(["zero", "low", "medium", "high"]))
				.optional(),
		})
		.optional(),
});

// Delete organization (admin)
export const deleteOrganizationAdminSchema = z.object({
	id: z.string().uuid(),
});

// Export organizations (admin)
export const exportOrganizationsAdminSchema = z.object({
	organizationIds: z.array(z.string().uuid()).min(1).max(1000), // Max 1000 orgs per export
});

// Adjust credits (admin)
export const adjustCreditsAdminSchema = z.object({
	organizationId: z.string().uuid(),
	amount: z.number().refine((n) => n !== 0, "Amount cannot be zero"),
	description: z.string().min(1).max(500),
});

// Cancel subscription (admin)
export const cancelSubscriptionAdminSchema = z.object({
	subscriptionId: z.string(),
	immediate: z.boolean().default(false),
});

// Type exports
export type GetOrganizationsAdminInput = z.infer<
	typeof listOrganizationsAdminSchema
>;
export type DeleteOrganizationAdminInput = z.infer<
	typeof deleteOrganizationAdminSchema
>;
export type ExportOrganizationsAdminInput = z.infer<
	typeof exportOrganizationsAdminSchema
>;
export type AdjustCreditsAdminInput = z.infer<typeof adjustCreditsAdminSchema>;
export type CancelSubscriptionAdminInput = z.infer<
	typeof cancelSubscriptionAdminSchema
>;
