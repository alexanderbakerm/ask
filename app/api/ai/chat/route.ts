import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
	type ChatModelId,
	chatModels,
	DEFAULT_CHAT_MODEL,
} from "@/config/billing.config";
import { assertUserIsOrgMember, getSession } from "@/lib/auth/server";
import {
	CreditError,
	calculateCreditCost,
	consumeCredits,
	estimateCreditCost,
	getCreditBalance,
	InsufficientCreditsError,
	logFailedDeduction,
} from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { aiChatTable } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const maxDuration = 30;

// Extract allowed model IDs from shared config
const ALLOWED_MODEL_IDS = chatModels.map((m) => m.id);

// Type guard to check if a model is allowed
function isAllowedModel(model: string): model is ChatModelId {
	return ALLOWED_MODEL_IDS.includes(model as ChatModelId);
}

// Input validation schema
const chatRequestSchema = z.object({
	messages: z.array(
		z
			.object({
				role: z.enum(["user", "assistant", "system"]),
				content: z.string().optional(),
			})
			.passthrough(),
	),
	model: z.string().optional(),
	chatId: z.string().uuid().optional(),
	organizationId: z.string().uuid().optional(),
});

// Standard error response helper
function errorResponse(
	error: string,
	message: string,
	status: number,
	details?: Record<string, unknown>,
) {
	return Response.json(
		{ error, message, ...(details && { details }) },
		{ status },
	);
}

/**
 * This is a separate route handler instead of a tRPC procedure because tRPC
 * doesn't support streaming responses. The Vercel AI SDK's `streamText()`
 * returns chunks over time as the LLM generates tokens, which requires raw
 * HTTP streaming (ReadableStream + chunked transfer encoding). tRPC's
 * request/response model and JSON serialization would break this.
 */

export async function POST(req: Request) {
	const session = await getSession();

	if (!session) {
		return errorResponse("unauthorized", "Authentication required", 401);
	}

	// Validate request body
	let messages: { role: "user" | "assistant" | "system"; content: string }[];
	let chatId: string | undefined;
	let organizationId: string | undefined;
	let selectedModel: ChatModelId = DEFAULT_CHAT_MODEL;

	try {
		const body = await req.json();
		const parsed = chatRequestSchema.parse(body);

		chatId = parsed.chatId;
		organizationId = parsed.organizationId;

		// Normalize messages to ensure proper content string for credit calculation and streamText
		// The frontend might use 'parts' instead of 'content' for multimodal/edit support
		messages = parsed.messages.map((msg) => {
			let content = msg.content ?? "";

			// If content is missing, try to extract from parts (passed through via zod)
			if (!content) {
				const msgAny = msg as unknown as {
					parts?: { type: string; text?: string }[];
				};
				if (Array.isArray(msgAny.parts)) {
					const textPart = msgAny.parts.find((p) => p.type === "text");
					if (textPart?.text) {
						content = textPart.text;
					}
				}
			}

			return {
				role: msg.role,
				content,
			};
		});

		// Validate and set model
		if (parsed.model) {
			if (!isAllowedModel(parsed.model)) {
				return errorResponse(
					"invalid_model",
					`Model '${parsed.model}' is not supported. Allowed models: ${ALLOWED_MODEL_IDS.join(", ")}`,
					400,
					{ allowedModels: ALLOWED_MODEL_IDS },
				);
			}
			selectedModel = parsed.model;
		}
	} catch (error) {
		logger.warn({ error }, "Invalid chat request body");
		return errorResponse("invalid_request", "Invalid request body", 400);
	}

	// Verify user is a member of the organization before allowing access
	// This prevents attackers from accessing other organizations' chats by passing arbitrary organizationId
	if (organizationId) {
		try {
			await assertUserIsOrgMember(organizationId, session.user.id);
		} catch (error) {
			logger.debug(
				{ error, organizationId, userId: session.user.id },
				"AI chat access denied - user not member of organization",
			);
			return errorResponse("forbidden", "Access denied", 403);
		}
	}

	// Verify the chat belongs to the user's organization
	if (chatId && organizationId) {
		const chat = await db.query.aiChatTable.findFirst({
			where: and(
				eq(aiChatTable.id, chatId),
				eq(aiChatTable.organizationId, organizationId),
			),
		});

		if (!chat) {
			return errorResponse("not_found", "Chat not found", 404);
		}
	}

	// Check credit balance before proceeding (only for organization chats)
	if (organizationId) {
		const estimatedCost = estimateCreditCost(selectedModel, messages);

		try {
			const balance = await getCreditBalance(organizationId);

			if (balance.balance < estimatedCost) {
				return errorResponse(
					"insufficient_credits",
					"Not enough credits to send this message",
					402,
					{
						balance: balance.balance,
						estimated: estimatedCost,
						model: selectedModel,
					},
				);
			}
		} catch (error) {
			logger.error({ error, organizationId }, "Failed to check credit balance");
			return errorResponse(
				"internal_error",
				"Failed to check credit balance",
				500,
			);
		}
	}

	const result = streamText({
		model: openai(selectedModel),
		messages,
		async onFinish({ text, usage }) {
			const inputTokens = usage?.inputTokens ?? 0;
			const outputTokens = usage?.outputTokens ?? 0;

			// Deduct credits for organization chats
			if (organizationId) {
				const actualCost = calculateCreditCost(
					selectedModel,
					inputTokens,
					outputTokens,
				);

				try {
					await consumeCredits({
						organizationId,
						amount: actualCost,
						description: `AI Chat (${selectedModel})`,
						model: selectedModel,
						inputTokens,
						outputTokens,
						referenceType: "ai_chat",
						referenceId: chatId,
						createdBy: session.user.id,
					});
				} catch (error) {
					// Log the failure for reconciliation
					const errorCode =
						error instanceof InsufficientCreditsError
							? "INSUFFICIENT_CREDITS"
							: error instanceof CreditError
								? error.code
								: "UNKNOWN_ERROR";

					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";

					// Log to failure table for later reconciliation
					await logFailedDeduction({
						organizationId,
						amount: actualCost,
						errorCode,
						errorMessage,
						model: selectedModel,
						inputTokens,
						outputTokens,
						referenceType: "ai_chat",
						referenceId: chatId,
						userId: session.user.id,
					});

					if (error instanceof InsufficientCreditsError) {
						logger.warn(
							{
								organizationId,
								model: selectedModel,
								required: actualCost,
								available: error.available,
							},
							"Insufficient credits during streaming - logged for reconciliation",
						);
					} else {
						logger.error(
							{ error, organizationId, model: selectedModel },
							"Failed to deduct credits - logged for reconciliation",
						);
					}
				}
			}

			// Save the assistant's response to the database
			if (chatId) {
				const updatedMessages = [
					...messages,
					{
						role: "assistant",
						content: text,
					},
				];

				await db
					.update(aiChatTable)
					.set({
						messages: JSON.stringify(updatedMessages),
					})
					.where(eq(aiChatTable.id, chatId));
			}
		},
	});

	return result.toTextStreamResponse();
}
