import { z } from "zod/v4";

// Sortable fields for subscriptions
export const SubscriptionSortField = z.enum([
	"organizationName",
	"status",
	"interval",
	"currentPeriodEnd",
	"createdAt",
]);
export type SubscriptionSortField = z.infer<typeof SubscriptionSortField>;

export const listSubscriptionsAdminSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
	query: z.string().optional(),
	sortBy: SubscriptionSortField.default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	filters: z
		.object({
			status: z
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
			interval: z.array(z.enum(["month", "year"])).optional(),
			createdAt: z
				.array(z.enum(["today", "this-week", "this-month", "older"]))
				.optional(),
		})
		.optional(),
});

export const exportSubscriptionsAdminSchema = z.object({
	subscriptionIds: z
		.array(z.string().startsWith("sub_", "Invalid subscription ID format"))
		.min(1, "At least one subscription must be selected")
		.max(1000, "Cannot export more than 1000 records at once"),
	delimiter: z.enum(["comma", "semicolon", "tab"]).optional().default("comma"),
});

export const syncSubscriptionsAdminSchema = z.object({
	subscriptionIds: z
		.array(z.string().startsWith("sub_", "Invalid subscription ID format"))
		.min(1, "At least one subscription must be selected")
		.max(100, "Cannot sync more than 100 subscriptions at once"),
});

export const cancelSubscriptionAdminSchema = z.object({
	subscriptionId: z
		.string()
		.startsWith("sub_", "Invalid subscription ID format"),
	immediate: z.boolean().default(false),
});

export type ListSubscriptionsAdminInput = z.infer<
	typeof listSubscriptionsAdminSchema
>;
export type ExportSubscriptionsAdminInput = z.infer<
	typeof exportSubscriptionsAdminSchema
>;
export type SyncSubscriptionsAdminInput = z.infer<
	typeof syncSubscriptionsAdminSchema
>;
export type CancelSubscriptionAdminInput = z.infer<
	typeof cancelSubscriptionAdminSchema
>;
