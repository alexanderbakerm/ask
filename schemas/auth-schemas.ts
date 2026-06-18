import { z } from "zod/v4";
import { passwordValidator } from "@/lib/auth/utils";

// Sign in form validation
export const signInSchema = z.object({
	email: z.string().trim().max(255, "Maximum 255 characters allowed."),
	password: z.string().max(72, "Maximum 72 characters allowed."),
});

// Sign up form validation
export const signUpSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required.")
		.max(64, "Maximum 64 characters allowed."),
	email: z
		.string()
		.trim()
		.min(1, "Email is required.")
		.max(255, "Maximum 255 characters allowed.")
		.email("Enter a valid email address."),
	password: z
		.string()
		.min(1, "Password is required.")
		.max(72, "Maximum 72 characters allowed.")
		.refine((arg) => passwordValidator.validate(arg).success, {
			message: "Password does not meet requirements.",
		}),
});

// OTP verification form
export const otpSchema = z.object({
	code: z.string().min(6).max(6),
});

// Forgot password form
export const forgotPasswordSchema = z.object({
	email: z
		.string()
		.trim()
		.min(1, "Email is required.")
		.max(255, "Maximum 255 characters allowed.")
		.email("Enter a valid email address."),
});

// Reset password form
export const resetPasswordSchema = z.object({
	password: z
		.string()
		.min(1, "Password is required.")
		.max(72, "Maximum 72 characters allowed.")
		.refine((arg) => passwordValidator.validate(arg).success, {
			message: "Password does not meet requirements.",
		}),
});

// Type exports
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
