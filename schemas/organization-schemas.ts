import { z } from "zod/v4";

// Get organization by ID
export const getOrganizationByIdSchema = z.object({ id: z.string().uuid() });

// Metadata value schema - JSON-serializable primitive, array, or object
const metadataValueSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.null(),
	z.array(z.unknown()),
	z.record(z.string(), z.unknown()),
]);

// Metadata schema - flexible key-value store for organization-specific data
// Limits: max 20 keys, value must be JSON-serializable
const organizationMetadataSchema = z
	.record(z.string(), metadataValueSchema)
	.refine((obj) => Object.keys(obj).length <= 20, {
		message: "Metadata cannot have more than 20 keys",
	})
	.optional();

// Create organization
export const createOrganizationSchema = z.object({
	name: z.string().min(1).max(100).trim(),
	metadata: organizationMetadataSchema,
});

// Update organization
export const updateOrganizationSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).trim(),
	metadata: organizationMetadataSchema,
});

// Invite member form
export const inviteMemberSchema = z.object({
	email: z.string().email(),
	role: z.enum(["member", "owner", "admin"]),
});

// Create organization form
export const createOrganizationFormSchema = z.object({
	name: z.string().min(1, "Organization name is required"),
});

// Change organization name form
export const changeOrganizationNameSchema = z.object({
	name: z.string().min(1).max(64),
});

// Type exports
export type GetOrganizationByIdInput = z.infer<
	typeof getOrganizationByIdSchema
>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateOrganizationFormValues = z.infer<
	typeof createOrganizationFormSchema
>;
export type ChangeOrganizationNameInput = z.infer<
	typeof changeOrganizationNameSchema
>;
