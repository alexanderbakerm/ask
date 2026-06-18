import { z } from "zod/v4";

// Get credit transactions with pagination
export const getOrganizationCreditTransactionsSchema = z.object({
	limit: z.number().min(1).max(100).optional().default(20),
	offset: z.number().min(0).optional().default(0),
});

// Purchase credit package
export const purchaseOrganizationCreditSchema = z.object({
	packageId: z.string().min(1, "Package ID is required"),
});

// Type exports
export type GetOrganizationCreditTransactionsInput = z.infer<
	typeof getOrganizationCreditTransactionsSchema
>;
export type PurchaseOrganizationCreditInput = z.infer<
	typeof purchaseOrganizationCreditSchema
>;
