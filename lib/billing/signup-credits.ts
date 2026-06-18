import "server-only";

import { and, eq } from "drizzle-orm";
import { signupBonusCredits } from "@/config/billing.config";
import { addCredits } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { creditTransactionTable, memberTable } from "@/lib/db/schema";
import { CreditTransactionType } from "@/lib/db/schema/enums";
import { LoggerFactory } from "@/lib/logger/factory";

const logger = LoggerFactory.getLogger("signup-credits");

const SIGNUP_BONUS_REFERENCE_TYPE = "signup_bonus";

/**
 * Grants the one-time signup bonus to a user's first organization.
 * Idempotent per user — safe to call from org-creation hooks.
 */
export async function grantSignupCreditsIfEligible(params: {
	organizationId: string;
	userId: string;
}): Promise<void> {
	const { organizationId, userId } = params;

	const existingBonus = await db.query.creditTransactionTable.findFirst({
		where: and(
			eq(creditTransactionTable.referenceType, SIGNUP_BONUS_REFERENCE_TYPE),
			eq(creditTransactionTable.referenceId, userId),
		),
		columns: { id: true },
	});

	if (existingBonus) {
		return;
	}

	// Only the org creator's first organization receives the bonus.
	const memberships = await db
		.select({ organizationId: memberTable.organizationId })
		.from(memberTable)
		.where(eq(memberTable.userId, userId));

	if (
		memberships.length !== 1 ||
		memberships[0]?.organizationId !== organizationId
	) {
		return;
	}

	await addCredits({
		organizationId,
		amount: signupBonusCredits,
		type: CreditTransactionType.promo,
		description: `Welcome bonus — ${signupBonusCredits} free credits`,
		referenceType: SIGNUP_BONUS_REFERENCE_TYPE,
		referenceId: userId,
		createdBy: userId,
	});

	logger.info("Granted signup bonus credits", {
		organizationId,
		userId,
		amount: signupBonusCredits,
	});
}
