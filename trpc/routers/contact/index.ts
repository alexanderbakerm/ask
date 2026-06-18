import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { appConfig } from "@/config/app.config";
import { sendContactFormEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

const contactEmail = appConfig.contact.email;

const TURNSTILE_VERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare Turnstile verification response
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
type TurnstileVerifyResponse = {
	/** Whether the verification was successful */
	success: boolean;
	/** ISO timestamp of the challenge */
	challenge_ts?: string;
	/** Hostname of the site where the challenge was solved */
	hostname?: string;
	/** List of error codes if verification failed */
	"error-codes"?: Array<
		| "missing-input-secret"
		| "invalid-input-secret"
		| "missing-input-response"
		| "invalid-input-response"
		| "invalid-widget-id"
		| "invalid-parsed-secret"
		| "bad-request"
		| "timeout-or-duplicate"
		| "internal-error"
	>;
	/** Action from the widget (if configured) */
	action?: string;
	/** Custom data from the widget (if configured) */
	cdata?: string;
};

async function verifyTurnstileToken(token: string): Promise<boolean> {
	if (!env.TURNSTILE_SECRET_KEY) {
		return true; // Skip verification if not configured
	}

	const body = new URLSearchParams();
	body.append("secret", env.TURNSTILE_SECRET_KEY);
	body.append("response", token);

	try {
		const response = await fetch(TURNSTILE_VERIFY_URL, {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});

		if (!response.ok) {
			logger.error("Turnstile API request failed", {
				status: response.status,
				statusText: response.statusText,
			});
			return false;
		}

		const outcome: TurnstileVerifyResponse = await response.json();

		if (!outcome.success) {
			logger.warn("Turnstile verification failed", {
				errorCodes: outcome["error-codes"],
				hostname: outcome.hostname,
			});
		}

		return outcome.success === true;
	} catch (error) {
		logger.error("Turnstile verification error", { error });
		return false;
	}
}

export const contactRouter = createTRPCRouter({
	submit: publicProcedure
		.input(
			z.object({
				firstName: z.string().min(1, "First name is required"),
				lastName: z.string().min(1, "Last name is required"),
				email: z.email("Invalid email address"),
				message: z.string().min(10, "Message must be at least 10 characters"),
				captchaToken: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			// Verify captcha if configured
			if (env.TURNSTILE_SECRET_KEY) {
				if (!input.captchaToken) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "CAPTCHA verification is required",
					});
				}

				const isValid = await verifyTurnstileToken(input.captchaToken);
				if (!isValid) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "CAPTCHA verification failed. Please try again.",
					});
				}
			}

			if (!contactEmail) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Contact form is not configured",
				});
			}

			await sendContactFormEmail({
				recipient: contactEmail,
				appName: appConfig.appName,
				firstName: input.firstName,
				lastName: input.lastName,
				email: input.email,
				message: input.message,
			});

			return { success: true };
		}),
});
