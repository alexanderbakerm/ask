import { openai } from "@ai-sdk/openai";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { askbiModels } from "@/config/billing.config";
import { dialectForType } from "@/lib/ai/askbi/execute";
import { RunBudget } from "@/lib/ai/askbi/run-budget";
import { buildAskBiSystemPrompt } from "@/lib/ai/askbi/system-prompt";
import { type AskBiRunContext, createAskBiTools } from "@/lib/ai/askbi/tools";
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
import { dataSourceTable } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

// The agent runs multiple steps; give it more headroom than a single chat turn.
export const maxDuration = 60;

const askbiRequestSchema = z.object({
	messages: z.array(z.unknown()),
	organizationId: z.string().uuid(),
	dataSourceId: z.string().uuid(),
	chatId: z.string().uuid().optional(),
});

function errorResponse(error: string, message: string, status: number) {
	return Response.json({ error, message }, { status });
}

function extractText(message: UIMessage): string {
	const parts = (message as { parts?: { type: string; text?: string }[] })
		.parts;
	if (!Array.isArray(parts)) return "";
	return parts
		.filter((p) => p.type === "text" && typeof p.text === "string")
		.map((p) => p.text as string)
		.join(" ");
}

export async function POST(req: Request): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return errorResponse("unauthorized", "Authentication required", 401);
	}
	const userId = session.user.id;

	let body: z.infer<typeof askbiRequestSchema>;
	try {
		body = askbiRequestSchema.parse(await req.json());
	} catch (error) {
		logger.warn({ error }, "Invalid AskBI request body");
		return errorResponse("invalid_request", "Invalid request body", 400);
	}
	const { organizationId, dataSourceId, chatId } = body;
	const messages = body.messages as UIMessage[];

	// Org membership (prevents accessing another org's source/chat).
	try {
		await assertUserIsOrgMember(organizationId, userId);
	} catch {
		return errorResponse("forbidden", "Access denied", 403);
	}

	// Resolve the data source, scoped to the org.
	const dataSource = await db.query.dataSourceTable.findFirst({
		where: and(
			eq(dataSourceTable.id, dataSourceId),
			eq(dataSourceTable.organizationId, organizationId),
		),
	});
	if (!dataSource) {
		return errorResponse("not_found", "Data source not found", 404);
	}

	// Credit pre-check before any LLM call (coarse lower bound; the run is then
	// metered incrementally per step).
	const estimate = estimateCreditCost(
		askbiModels.sql,
		messages.map((m) => ({ role: m.role, content: extractText(m) })),
	);
	try {
		const balance = await getCreditBalance(organizationId);
		if (balance.balance < estimate) {
			return errorResponse(
				"insufficient_credits",
				"Not enough credits to run a query",
				402,
			);
		}
	} catch (error) {
		logger.error(
			{ error, organizationId },
			"AskBI credit balance check failed",
		);
		return errorResponse("internal_error", "Failed to check credits", 500);
	}

	const modelMessages = await convertToModelMessages(messages);

	const budget = new RunBudget();
	const context: AskBiRunContext = {
		question: extractText(messages[messages.length - 1] ?? ({} as UIMessage)),
		grounded: false,
	};
	const tools = createAskBiTools({
		dataSource,
		budget,
		context,
		userId,
		chatId,
	});

	const result = streamText({
		model: openai(askbiModels.sql),
		system: buildAskBiSystemPrompt({
			sourceName: dataSource.name,
			dialect: dialectForType(dataSource.type),
		}),
		messages: modelMessages,
		tools,
		stopWhen: stepCountIs(budget.maxSteps),
		abortSignal: budget.signal,
		// Meter INCREMENTALLY per completed step: a timed-out / aborted / errored
		// run still pays for the steps it consumed — no dependence on a terminal
		// callback firing, so credits can't leak in the "pathological run is free"
		// direction.
		onStepFinish: async ({ usage }) => {
			budget.recordStep();
			const inputTokens = usage?.inputTokens ?? 0;
			const outputTokens = usage?.outputTokens ?? 0;
			if (inputTokens + outputTokens === 0) return;
			const amount = calculateCreditCost(
				askbiModels.sql,
				inputTokens,
				outputTokens,
			);
			try {
				await consumeCredits({
					organizationId,
					amount,
					description: `AskBI (${askbiModels.sql})`,
					model: askbiModels.sql,
					inputTokens,
					outputTokens,
					referenceType: "ai_askbi",
					referenceId: chatId,
					createdBy: userId,
				});
			} catch (error) {
				const errorCode =
					error instanceof InsufficientCreditsError
						? "INSUFFICIENT_CREDITS"
						: error instanceof CreditError
							? error.code
							: "UNKNOWN_ERROR";
				await logFailedDeduction({
					organizationId,
					amount,
					errorCode,
					errorMessage:
						error instanceof Error ? error.message : "Unknown error",
					model: askbiModels.sql,
					inputTokens,
					outputTokens,
					referenceType: "ai_askbi",
					referenceId: chatId,
					userId,
				}).catch(() => {});
			}
		},
		onFinish: () => {
			logger.info(
				{ organizationId, dataSourceId, telemetry: budget.telemetry() },
				"AskBI run finished",
			);
			budget.dispose();
		},
		onError: ({ error }) => {
			logger.error(
				{ error, organizationId, dataSourceId },
				"AskBI run errored",
			);
			budget.dispose();
		},
	});

	return result.toUIMessageStreamResponse();
}
