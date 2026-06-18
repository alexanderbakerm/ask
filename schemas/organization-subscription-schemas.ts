import { z } from "zod/v4";
import { appConfig } from "@/config/app.config";

// Pagination schema for subscription queries
export const listSubscriptionsSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(appConfig.pagination.maxLimit)
		.default(appConfig.pagination.defaultLimit),
	offset: z.number().min(0).default(0),
});

// Get invoices schema
export const listInvoicesSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(appConfig.pagination.maxLimit)
		.default(appConfig.pagination.defaultLimit),
});

// Create checkout session schema
export const createCheckoutSchema = z.object({
	priceId: z.string().min(1, "Price ID is required"),
	quantity: z.number().min(1).default(1),
	successUrl: z.string().url().optional(),
	cancelUrl: z.string().url().optional(),
});

// Create portal session schema
export const createPortalSessionSchema = z.object({
	returnUrl: z.string().url().optional(),
});

// Plan change schema (used for both preview and mutation)
export const planChangeSchema = z.object({
	newPriceId: z.string().min(1, "Price ID is required"),
	quantity: z.number().min(1).optional(),
});

// Update seats schema
export const updateSeatsSchema = z.object({
	quantity: z.number().min(1, "At least 1 seat is required"),
});

// Type exports
export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type CreatePortalSessionInput = z.infer<
	typeof createPortalSessionSchema
>;
export type PlanChangeInput = z.infer<typeof planChangeSchema>;
export type UpdateSeatsInput = z.infer<typeof updateSeatsSchema>;
