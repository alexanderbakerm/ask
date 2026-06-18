import { z } from "zod/v4";
import { LeadSource, LeadStatus } from "@/lib/db/schema/enums";

// Sortable fields for leads
export const LeadSortField = z.enum([
	"name",
	"company",
	"email",
	"status",
	"source",
	"estimatedValue",
	"createdAt",
]);
export type LeadSortField = z.infer<typeof LeadSortField>;

// Get all leads with filters
export const listLeadsSchema = z.object({
	limit: z.number().min(1).max(100).default(50),
	offset: z.number().min(0).default(0),
	query: z.string().optional(),
	sortBy: LeadSortField.default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
	filters: z
		.object({
			status: z.array(z.nativeEnum(LeadStatus)).optional(),
			source: z.array(z.nativeEnum(LeadSource)).optional(),
			createdAt: z
				.array(z.enum(["today", "this-week", "this-month", "older"]))
				.optional(),
		})
		.optional(),
});

// Create lead
export const createLeadSchema = z.object({
	firstName: z
		.string()
		.trim()
		.min(1, "First name is required")
		.max(100, "First name is too long"),
	lastName: z
		.string()
		.trim()
		.min(1, "Last name is required")
		.max(100, "Last name is too long"),
	email: z
		.string()
		.trim()
		.email("Invalid email address")
		.max(255, "Email is too long"),
	phone: z.string().trim().max(50, "Phone number is too long").optional(),
	company: z.string().trim().max(200, "Company name is too long").optional(),
	jobTitle: z.string().trim().max(150, "Job title is too long").optional(),
	status: z.nativeEnum(LeadStatus).default(LeadStatus.new),
	source: z.nativeEnum(LeadSource).default(LeadSource.other),
	estimatedValue: z.number().min(0).optional(),
	notes: z.string().trim().max(5000, "Notes are too long").optional(),
	assignedToId: z.string().uuid().optional(),
});

// Update lead
export const updateLeadSchema = z.object({
	id: z.string().uuid(),
	firstName: z
		.string()
		.trim()
		.min(1, "First name is required")
		.max(100, "First name is too long")
		.optional(),
	lastName: z
		.string()
		.trim()
		.min(1, "Last name is required")
		.max(100, "Last name is too long")
		.optional(),
	email: z
		.string()
		.trim()
		.email("Invalid email address")
		.max(255, "Email is too long")
		.optional(),
	phone: z
		.string()
		.trim()
		.max(50, "Phone number is too long")
		.optional()
		.nullable(),
	company: z
		.string()
		.trim()
		.max(200, "Company name is too long")
		.optional()
		.nullable(),
	jobTitle: z
		.string()
		.trim()
		.max(150, "Job title is too long")
		.optional()
		.nullable(),
	status: z.nativeEnum(LeadStatus).optional(),
	source: z.nativeEnum(LeadSource).optional(),
	estimatedValue: z.number().min(0).optional().nullable(),
	notes: z
		.string()
		.trim()
		.max(5000, "Notes are too long")
		.optional()
		.nullable(),
	assignedToId: z.string().uuid().optional().nullable(),
});

// Delete lead
export const deleteLeadSchema = z.object({
	id: z.string().uuid(),
});

// Bulk delete leads
export const bulkDeleteLeadsSchema = z.object({
	ids: z.array(z.string().uuid()).min(1),
});

// Bulk update leads status
export const bulkUpdateLeadsStatusSchema = z.object({
	ids: z.array(z.string().uuid()).min(1),
	status: z.nativeEnum(LeadStatus),
});

// Export leads
export const exportLeadsSchema = z.object({
	leadIds: z.array(z.string().uuid()).min(1),
});

// Type exports
export type ListLeadsInput = z.infer<typeof listLeadsSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type DeleteLeadInput = z.infer<typeof deleteLeadSchema>;
export type BulkDeleteLeadsInput = z.infer<typeof bulkDeleteLeadsSchema>;
export type BulkUpdateLeadsStatusInput = z.infer<
	typeof bulkUpdateLeadsStatusSchema
>;
export type ExportLeadsInput = z.infer<typeof exportLeadsSchema>;
