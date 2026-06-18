import slugify from "@sindresorhus/slugify";
import { TRPCError } from "@trpc/server";
import { asc, eq, getTableColumns } from "drizzle-orm";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { appConfig } from "@/config/app.config";
import { auth } from "@/lib/auth";
import { assertUserIsOrgMember } from "@/lib/auth/server";
import { db, memberTable, organizationTable } from "@/lib/db";
import { creditBalanceTable } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import {
	createOrganizationSchema,
	getOrganizationByIdSchema,
} from "@/schemas/organization-schemas";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { organizationAiRouter } from "@/trpc/routers/organization/organization-ai-router";
import { organizationCreditRouter } from "@/trpc/routers/organization/organization-credit-router";
import { organizationDataSourceRouter } from "@/trpc/routers/organization/organization-datasource-router";
import { organizationLeadRouter } from "@/trpc/routers/organization/organization-lead-router";
import { organizationSavedQueryRouter } from "@/trpc/routers/organization/organization-savedquery-router";
import { organizationSubscriptionRouter } from "@/trpc/routers/organization/organization-subscription-router";

async function generateOrganizationSlug(name: string): Promise<string> {
	const baseSlug = slugify(name, {
		lowercase: true,
	});

	let slug = baseSlug;
	let hasAvailableSlug = false;

	for (let i = 0; i < 3; i++) {
		slug = `${baseSlug}-${nanoid(5)}`;

		const existing = await db.query.organizationTable.findFirst({
			where: (org, { eq }) => eq(org.slug, slug),
		});

		if (!existing) {
			hasAvailableSlug = true;
			break;
		}
	}

	if (!hasAvailableSlug) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No available slug found",
		});
	}

	return slug;
}

export const organizationRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const organizations = await db
			.select({
				...getTableColumns(organizationTable),
				membersCount: db
					.$count(
						memberTable,
						eq(memberTable.organizationId, organizationTable.id),
					)
					.as("membersCount"),
			})
			.from(organizationTable)
			.innerJoin(
				memberTable,
				eq(organizationTable.id, memberTable.organizationId),
			)
			.where(eq(memberTable.userId, ctx.user.id))
			.orderBy(asc(organizationTable.createdAt));

		return organizations.map((org) => ({
			...org,
			slug: org.slug || "",
		}));
	}),
	get: protectedProcedure
		.input(getOrganizationByIdSchema)
		.query(async ({ ctx, input }) => {
			// Verify user is a member of this organization (throws if not)
			const { organization } = await assertUserIsOrgMember(
				input.id,
				ctx.user.id,
			);

			return organization;
		}),
	create: protectedProcedure
		.input(createOrganizationSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if organization creation is allowed for non-admin users
			if (
				!appConfig.organizations.allowUserCreation &&
				ctx.user.role !== "admin"
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Organization creation is disabled. Contact an administrator.",
				});
			}

			const organization = await auth.api.createOrganization({
				headers: await headers(),
				body: {
					name: input.name,
					slug: await generateOrganizationSlug(input.name), // Slug is kept for internal reference but not used in URLs
					metadata: input.metadata,
				},
			});

			if (!organization) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create organization",
				});
			}

			// Initialize credit balance for the new organization
			// This ensures the organization has a balance record from creation
			// rather than relying on lazy initialization
			try {
				await db
					.insert(creditBalanceTable)
					.values({ organizationId: organization.id })
					.onConflictDoNothing();
			} catch (error) {
				// Log but don't fail org creation - balance will be created lazily if needed
				logger.warn(
					{ organizationId: organization.id, error },
					"Failed to initialize credit balance for new organization",
				);
			}

			return organization;
		}),

	// Context-specific sub-routers
	ai: organizationAiRouter,
	credit: organizationCreditRouter,
	dataSource: organizationDataSourceRouter,
	lead: organizationLeadRouter,
	savedQuery: organizationSavedQueryRouter,
	subscription: organizationSubscriptionRouter,
});
