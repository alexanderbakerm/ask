import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { appConfig } from "@/config/app.config";
import { db } from "@/lib/db";
import { aiChatTable } from "@/lib/db/schema";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

// Chat message schema - matches the format used by ai-chat.tsx and useChat hook
const chatMessageSchema = z.object({
	role: z.enum(["user", "assistant", "system"]),
	content: z.string().max(100000), // Reasonable max length for a message
	isError: z.boolean().optional(),
});

export const organizationAiRouter = createTRPCRouter({
	// List all chats for the organization
	// Note: We only select fields needed for the sidebar list view to avoid
	// loading potentially large message arrays. The full messages are loaded
	// via getChat when a specific chat is selected.
	listChats: protectedOrganizationProcedure
		.input(
			z
				.object({
					limit: z
						.number()
						.min(1)
						.max(appConfig.pagination.maxLimit)
						.optional()
						.default(appConfig.pagination.defaultLimit),
					offset: z.number().min(0).optional().default(0),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			// Use SQL builder to select only needed columns and extract first message
			// for title fallback without loading entire messages array
			const chats = await db
				.select({
					id: aiChatTable.id,
					title: aiChatTable.title,
					pinned: aiChatTable.pinned,
					createdAt: aiChatTable.createdAt,
					// Extract first message content from JSON array for title preview
					// Uses PostgreSQL JSON operators: ->0 gets first element, ->'content' gets content field
					firstMessageContent: sql<string | null>`
						CASE 
							WHEN ${aiChatTable.messages} IS NOT NULL 
								AND ${aiChatTable.messages}::jsonb != '[]'::jsonb 
							THEN (${aiChatTable.messages}::jsonb->0->>'content')
							ELSE NULL 
						END
					`.as("first_message_content"),
				})
				.from(aiChatTable)
				.where(eq(aiChatTable.organizationId, ctx.organization.id))
				.orderBy(desc(aiChatTable.pinned), desc(aiChatTable.createdAt))
				.limit(input?.limit ?? 20)
				.offset(input?.offset ?? 0);

			return {
				chats,
			};
		}),

	// Get a single chat by ID
	getChat: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const chat = await db.query.aiChatTable.findFirst({
				where: and(
					eq(aiChatTable.id, input.id),
					eq(aiChatTable.organizationId, ctx.organization.id),
				),
			});

			if (!chat) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				});
			}

			return {
				chat: {
					...chat,
					messages: chat.messages ? JSON.parse(chat.messages) : [],
				},
			};
		}),

	// Create a new chat
	createChat: protectedOrganizationProcedure
		.input(
			z
				.object({
					title: z.string().optional(),
				})
				.optional(),
		)
		.mutation(async ({ ctx, input }) => {
			const [chat] = await db
				.insert(aiChatTable)
				.values({
					organizationId: ctx.organization.id,
					userId: ctx.user.id,
					title: input?.title,
					messages: JSON.stringify([]),
				})
				.returning();

			return {
				chat: {
					...chat,
					messages: [],
				},
			};
		}),

	// Update a chat (title or messages)
	updateChat: protectedOrganizationProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().max(200).optional(),
				messages: z.array(chatMessageSchema).max(1000).optional(), // Max 1000 messages per chat
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingChat = await db.query.aiChatTable.findFirst({
				where: and(
					eq(aiChatTable.id, input.id),
					eq(aiChatTable.organizationId, ctx.organization.id),
				),
			});

			if (!existingChat) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				});
			}

			const [updated] = await db
				.update(aiChatTable)
				.set({
					title: input.title ?? existingChat.title,
					messages: input.messages
						? JSON.stringify(input.messages)
						: existingChat.messages,
				})
				.where(eq(aiChatTable.id, input.id))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update chat",
				});
			}

			return {
				chat: {
					...updated,
					messages: updated.messages ? JSON.parse(updated.messages) : [],
				},
			};
		}),

	// Delete a chat
	deleteChat: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const existingChat = await db.query.aiChatTable.findFirst({
				where: and(
					eq(aiChatTable.id, input.id),
					eq(aiChatTable.organizationId, ctx.organization.id),
				),
			});

			if (!existingChat) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				});
			}

			await db.delete(aiChatTable).where(eq(aiChatTable.id, input.id));

			return { success: true };
		}),

	// Toggle pin status of a chat
	togglePin: protectedOrganizationProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const existingChat = await db.query.aiChatTable.findFirst({
				where: and(
					eq(aiChatTable.id, input.id),
					eq(aiChatTable.organizationId, ctx.organization.id),
				),
			});

			if (!existingChat) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				});
			}

			const [updated] = await db
				.update(aiChatTable)
				.set({
					pinned: !existingChat.pinned,
				})
				.where(eq(aiChatTable.id, input.id))
				.returning();

			return {
				chat: updated,
				pinned: updated?.pinned ?? false,
			};
		}),

	// Search chats by title or message content
	searchChats: protectedOrganizationProcedure
		.input(
			z.object({
				query: z.string().min(1).max(100),
				limit: z
					.number()
					.min(1)
					.max(appConfig.pagination.maxLimit)
					.optional()
					.default(20),
			}),
		)
		.query(async ({ ctx, input }) => {
			const searchPattern = `%${input.query}%`;

			// Search in title and message content using PostgreSQL JSON search
			const chats = await db
				.select({
					id: aiChatTable.id,
					title: aiChatTable.title,
					pinned: aiChatTable.pinned,
					createdAt: aiChatTable.createdAt,
					firstMessageContent: sql<string | null>`
						CASE 
							WHEN ${aiChatTable.messages} IS NOT NULL 
								AND ${aiChatTable.messages}::jsonb != '[]'::jsonb 
							THEN (${aiChatTable.messages}::jsonb->0->>'content')
							ELSE NULL 
						END
					`.as("first_message_content"),
				})
				.from(aiChatTable)
				.where(
					and(
						eq(aiChatTable.organizationId, ctx.organization.id),
						or(
							// Search in title
							ilike(aiChatTable.title, searchPattern),
							// Search in message content using PostgreSQL JSON text search
							sql`${aiChatTable.messages}::text ILIKE ${searchPattern}`,
						),
					),
				)
				.orderBy(desc(aiChatTable.pinned), desc(aiChatTable.createdAt))
				.limit(input.limit);

			return { chats };
		}),
});
