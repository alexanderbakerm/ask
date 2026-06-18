import { z } from "zod/v4";

// Sortable fields for credit balances
export const CreditBalanceSortField = z.enum([
	"organizationName",
	"balance",
	"lifetimePurchased",
	"lifetimeGranted",
	"lifetimeUsed",
]);
export type CreditBalanceSortField = z.infer<typeof CreditBalanceSortField>;

export const listCreditBalancesAdminSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	offset: z.number().min(0).default(0),
	query: z.string().optional(),
	sortBy: CreditBalanceSortField.default("balance"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	filters: z
		.object({
			balanceRange: z
				.array(z.enum(["zero", "low", "medium", "high"]))
				.optional(),
			plans: z.array(z.string()).optional(),
			activityStatus: z
				.array(z.enum(["active_30d", "inactive", "never_used"]))
				.optional(),
		})
		.optional(),
});

export const listTransactionsAdminSchema = z.object({
	limit: z.number().min(1).max(100).default(50),
	offset: z.number().min(0).default(0),
	organizationId: z.string().uuid().optional(),
	type: z
		.enum([
			"purchase",
			"subscription_grant",
			"bonus",
			"promo",
			"usage",
			"refund",
			"expire",
			"adjustment",
		])
		.optional(),
});

export const exportCreditBalancesAdminSchema = z.object({
	organizationIds: z
		.array(z.string().uuid())
		.min(1, "At least one organization must be selected")
		.max(1000, "Cannot export more than 1000 records at once"),
	delimiter: z.enum(["comma", "semicolon", "tab"]).optional().default("comma"),
});

export type GetCreditBalancesAdminInput = z.infer<
	typeof listCreditBalancesAdminSchema
>;
export type GetAllTransactionsAdminInput = z.infer<
	typeof listTransactionsAdminSchema
>;
export type ExportCreditBalancesAdminInput = z.infer<
	typeof exportCreditBalancesAdminSchema
>;
