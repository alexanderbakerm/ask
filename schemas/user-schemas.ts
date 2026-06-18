import { z } from "zod/v4";
import { passwordValidator } from "@/lib/auth/utils";

// Change email form
export const changeEmailSchema = z.object({
	email: z.string().email(),
});

// Change name form
export const changeNameSchema = z.object({
	name: z.string().min(1).max(64),
});

// Change password form
export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required."),
	newPassword: z
		.string()
		.min(1, "New password is required.")
		.max(72, "Maximum 72 characters allowed."),
});

// Change password form with validation
export const changePasswordFormSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required."),
	newPassword: z
		.string()
		.min(1, "New password is required.")
		.max(72, "Maximum 72 characters allowed.")
		.refine((arg) => passwordValidator.validate(arg).success, {
			message: "New password does not meet requirements.",
		}),
});

// Type exports
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangeNameInput = z.infer<typeof changeNameSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
