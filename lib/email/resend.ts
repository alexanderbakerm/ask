import { type CreateEmailResponse, Resend } from "resend";
import { env } from "@/lib/env";
import { LoggerFactory } from "@/lib/logger/factory";

const logger = LoggerFactory.getLogger("email");

/**
 * Email retry configuration.
 * Uses exponential backoff: delay = baseDelayMs * 2^attempt
 * Default: 3 attempts with 1s, 2s, 4s delays
 */
const EMAIL_RETRY_CONFIG = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 10000,
};

/**
 * Check if an error is retryable (transient vs permanent).
 * Permanent errors (invalid email, auth failure) should not be retried.
 */
function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return true;

	const message = error.message.toLowerCase();

	// Permanent errors - don't retry
	const permanentErrors = [
		"invalid email", // Invalid recipient
		"email address is not valid", // Invalid format
		"unauthorized", // API key issues
		"forbidden", // Permission issues
		"not found", // Resource not found
		"unsubscribed", // Recipient unsubscribed
		"blocked", // Email blocked by provider
		"spam", // Marked as spam
		"bounce", // Previous bounces
	];

	return !permanentErrors.some((pe) => message.includes(pe));
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export type EmailPayload = {
	recipient: string;
	subject: string;
	text: string;
	html: string;
	replyTo?: string;
};

/**
 * Sanitize email header value to prevent header injection attacks.
 * Removes newlines, carriage returns, and other control characters.
 */
function sanitizeEmailHeader(value: string): string {
	// Remove all control characters including \r, \n, \t, and null bytes
	// Using character codes to avoid linter issues with control chars in regex
	// eslint-disable-next-line no-control-regex
	return value.replace(/[\r\n\t\0]/g, "").trim();
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
	if (!resendClient) {
		const apiKey = env.RESEND_API_KEY;
		if (!apiKey) {
			throw new Error("Missing RESEND_API_KEY in environment configuration");
		}
		resendClient = new Resend(apiKey);
	}
	return resendClient;
}

/**
 * Send an email using Resend.
 * Includes retry logic with exponential backoff for transient errors.
 */
export async function sendEmail(
	payload: EmailPayload,
): Promise<CreateEmailResponse> {
	const from = env.EMAIL_FROM;
	if (!from) {
		throw new Error("Missing EMAIL_FROM in environment configuration");
	}

	// Sanitize replyTo to prevent header injection attacks
	const sanitizedReplyTo = payload.replyTo
		? sanitizeEmailHeader(payload.replyTo)
		: undefined;

	const { maxAttempts, baseDelayMs, maxDelayMs } = EMAIL_RETRY_CONFIG;
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const response = await getResendClient().emails.send({
				from,
				to: payload.recipient,
				subject: payload.subject,
				html: payload.html,
				text: payload.text,
				replyTo: sanitizedReplyTo,
			});

			if (response.error) {
				throw new Error(response.error.message ?? "Could not send mail.");
			}

			// Success - log if it required retries
			if (attempt > 0) {
				logger.info("Email sent after retry", {
					recipient: payload.recipient,
					subject: payload.subject,
					attempts: attempt + 1,
				});
			}

			return response;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Check if error is retryable
			if (!isRetryableError(error)) {
				logger.error("Email failed with permanent error (not retrying)", {
					recipient: payload.recipient,
					subject: payload.subject,
					error: lastError.message,
				});
				throw lastError;
			}

			// Log retry attempt
			const isLastAttempt = attempt === maxAttempts - 1;
			if (!isLastAttempt) {
				// Calculate delay with exponential backoff
				const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);

				logger.warn("Email send failed, retrying", {
					recipient: payload.recipient,
					subject: payload.subject,
					attempt: attempt + 1,
					maxAttempts,
					delayMs: delay,
					error: lastError.message,
				});

				await sleep(delay);
			}
		}
	}

	// All retries exhausted
	logger.error("Email failed after all retry attempts", {
		recipient: payload.recipient,
		subject: payload.subject,
		attempts: maxAttempts,
		error: lastError?.message,
	});

	throw lastError ?? new Error("Email send failed after all retry attempts");
}
