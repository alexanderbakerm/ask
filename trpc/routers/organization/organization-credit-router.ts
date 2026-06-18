import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import { creditPackages } from "@/config/billing.config";
import {
	createCheckoutSession,
	getOrCreateStripeCustomer,
} from "@/lib/billing";
import {
	getCreditBalance,
	listCreditTransactions,
} from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { creditTransactionTable } from "@/lib/db/schema";
import { MemberRole } from "@/lib/db/schema/enums";
import {
	getOrganizationCreditTransactionsSchema,
	purchaseOrganizationCreditSchema,
} from "@/schemas/organization-credit-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationCreditRouter = createTRPCRouter({
	getBalance: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const balance = await getCreditBalance(ctx.organization.id);

		return {
			balance: balance.balance,
			lifetimePurchased: balance.lifetimePurchased,
			lifetimeGranted: balance.lifetimeGranted,
			lifetimeUsed: balance.lifetimeUsed,
		};
	}),

	getTransactions: protectedOrganizationProcedure
		.input(getOrganizationCreditTransactionsSchema)
		.query(async ({ ctx, input }) => {
			// Get total count for pagination
			const [countResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(creditTransactionTable)
				.where(eq(creditTransactionTable.organizationId, ctx.organization.id));

			const total = countResult?.count ?? 0;

			const transactions = await listCreditTransactions(ctx.organization.id, {
				limit: input.limit,
				offset: input.offset,
			});

			return {
				transactions: transactions.map((tx) => ({
					id: tx.id,
					type: tx.type,
					amount: tx.amount,
					balanceAfter: tx.balanceAfter,
					description: tx.description,
					model: tx.model,
					createdAt: tx.createdAt,
				})),
				total,
				hasMore: (input.offset ?? 0) + transactions.length < total,
			};
		}),

	getPackages: protectedOrganizationProcedure.query(async () => {
		return creditPackages.map((pkg) => ({
			id: pkg.id,
			name: pkg.name,
			description: pkg.description,
			credits: pkg.credits,
			bonusCredits: pkg.bonusCredits,
			totalCredits: pkg.credits + pkg.bonusCredits,
			priceAmount: pkg.priceAmount,
			currency: pkg.currency,
			popular: pkg.popular,
		}));
	}),

	purchaseCredits: protectedOrganizationProcedure
		.input(purchaseOrganizationCreditSchema)
		.mutation(async ({ ctx, input }) => {
			const { organization, user, membership } = ctx;

			// Only admins can purchase
			if (
				membership.role !== MemberRole.owner &&
				membership.role !== MemberRole.admin
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only organization admins can purchase credits",
				});
			}

			// Validate package
			const pkg = creditPackages.find((p) => p.id === input.packageId);
			if (!pkg) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid credit package",
				});
			}

			// Check if Stripe price ID is configured
			if (!pkg.stripePriceId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Credit package not configured for purchase",
				});
			}

			// Get or create Stripe customer
			const customer = await getOrCreateStripeCustomer({
				organizationId: organization.id,
				organizationName: organization.name,
				email: user.email,
			});

			// Create checkout session
			const baseUrl = appConfig.baseUrl;
			const { url } = await createCheckoutSession({
				organizationId: organization.id,
				stripePriceId: pkg.stripePriceId,
				stripeCustomerId: customer.id,
				quantity: 1,
				successUrl: `${baseUrl}/dashboard/organization/settings?tab=credits&success=true`,
				cancelUrl: `${baseUrl}/dashboard/organization/settings?tab=credits&canceled=true`,
				metadata: {
					type: "credit_purchase",
					packageId: pkg.id,
					organizationId: organization.id,
					userId: user.id,
				},
			});

			return { url };
		}),
});
