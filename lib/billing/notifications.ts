import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import { db } from "@/lib/db";
import { memberTable, organizationTable, userTable } from "@/lib/db/schema";
import { MemberRole } from "@/lib/db/schema/enums";
import {
	sendDisputeReceivedEmail,
	sendPaymentFailedEmail,
	sendSubscriptionCanceledEmail,
	sendTrialEndingSoonEmail,
} from "@/lib/email";
import { LoggerFactory } from "@/lib/logger/factory";

const logger = LoggerFactory.getLogger("billing-notifications");

/**
 * Get organization admins (owners and admins) with their email addresses
 * Optimized to filter in SQL instead of fetching all members
 */
async function getOrganizationAdmins(
	organizationId: string,
): Promise<Array<{ email: string; name: string }>> {
	const adminRoles = [MemberRole.owner, MemberRole.admin];

	const members = await db
		.select({
			email: userTable.email,
			name: userTable.name,
		})
		.from(memberTable)
		.innerJoin(userTable, eq(memberTable.userId, userTable.id))
		.where(
			and(
				eq(memberTable.organizationId, organizationId),
				inArray(memberTable.role, adminRoles),
			),
		);

	return members;
}

/**
 * Get organization name by ID
 */
async function getOrganizationName(
	organizationId: string,
): Promise<string | null> {
	const org = await db.query.organizationTable.findFirst({
		where: eq(organizationTable.id, organizationId),
		columns: { name: true },
	});
	return org?.name ?? null;
}

/**
 * Send payment failed notification to all organization admins
 */
export async function sendPaymentFailedNotification(params: {
	organizationId: string;
	amount: number;
	currency: string;
	invoiceId?: string;
}): Promise<void> {
	const { organizationId, amount, currency, invoiceId } = params;

	try {
		// Get organization name
		const organizationName = await getOrganizationName(organizationId);
		if (!organizationName) {
			logger.error("Organization not found for payment failed notification", {
				organizationId,
			});
			return;
		}

		// Get all admins
		const admins = await getOrganizationAdmins(organizationId);
		if (admins.length === 0) {
			logger.warn("No admins found for organization", { organizationId });
			return;
		}

		// Format amount
		const formattedAmount = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount / 100);

		// Build update payment link
		const updatePaymentLink = `${appConfig.baseUrl}/dashboard/organization/settings?tab=subscription`;

		// Send email to all admins
		const emailPromises = admins.map((admin) =>
			sendPaymentFailedEmail({
				recipient: admin.email,
				appName: appConfig.appName,
				organizationName,
				userName: admin.name,
				amount: formattedAmount,
				currency,
				updatePaymentLink,
				invoiceId,
			}),
		);

		await Promise.allSettled(emailPromises);

		logger.info("Payment failed notifications sent", {
			organizationId,
			recipientCount: admins.length,
		});
	} catch (error) {
		logger.error("Failed to send payment failed notifications", {
			organizationId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}

/**
 * Send subscription canceled notification to all organization admins
 */
export async function sendSubscriptionCanceledNotification(params: {
	organizationId: string;
	planName: string;
	cancelDate: Date;
	accessEndDate: Date;
}): Promise<void> {
	const { organizationId, planName, cancelDate, accessEndDate } = params;

	try {
		// Get organization name
		const organizationName = await getOrganizationName(organizationId);
		if (!organizationName) {
			logger.error(
				"Organization not found for subscription canceled notification",
				{ organizationId },
			);
			return;
		}

		// Get all admins
		const admins = await getOrganizationAdmins(organizationId);
		if (admins.length === 0) {
			logger.warn("No admins found for organization", { organizationId });
			return;
		}

		// Format dates
		const formattedCancelDate = cancelDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
		const formattedAccessEndDate = accessEndDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		// Send email to all admins
		const emailPromises = admins.map((admin) =>
			sendSubscriptionCanceledEmail({
				recipient: admin.email,
				appName: appConfig.appName,
				organizationName,
				userName: admin.name,
				planName,
				cancelDate: formattedCancelDate,
				accessEndDate: formattedAccessEndDate,
			}),
		);

		await Promise.allSettled(emailPromises);

		logger.info("Subscription canceled notifications sent", {
			organizationId,
			recipientCount: admins.length,
		});
	} catch (error) {
		logger.error("Failed to send subscription canceled notifications", {
			organizationId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}

/**
 * Send trial ending soon notification to all organization admins
 */
export async function sendTrialEndingSoonNotification(params: {
	organizationId: string;
	planName: string;
	trialEndDate: Date;
	daysRemaining: number;
}): Promise<void> {
	const { organizationId, planName, trialEndDate, daysRemaining } = params;

	try {
		// Get organization name
		const organizationName = await getOrganizationName(organizationId);
		if (!organizationName) {
			logger.error(
				"Organization not found for trial ending soon notification",
				{ organizationId },
			);
			return;
		}

		// Get all admins
		const admins = await getOrganizationAdmins(organizationId);
		if (admins.length === 0) {
			logger.warn("No admins found for organization", { organizationId });
			return;
		}

		// Format trial end date
		const formattedTrialEndDate = trialEndDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		// Build billing settings link
		const billingSettingsLink = `${appConfig.baseUrl}/dashboard/organization/settings?tab=subscription`;

		// Send email to all admins
		const emailPromises = admins.map((admin) =>
			sendTrialEndingSoonEmail({
				recipient: admin.email,
				appName: appConfig.appName,
				organizationName,
				userName: admin.name,
				planName,
				trialEndDate: formattedTrialEndDate,
				daysRemaining,
				billingSettingsLink,
			}),
		);

		await Promise.allSettled(emailPromises);

		logger.info("Trial ending soon notifications sent", {
			organizationId,
			recipientCount: admins.length,
			daysRemaining,
		});
	} catch (error) {
		logger.error("Failed to send trial ending soon notifications", {
			organizationId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}

/**
 * Send dispute/chargeback notification to all organization admins
 * Disputes require immediate attention as they can result in fund loss
 */
export async function sendDisputeNotification(params: {
	organizationId: string;
	disputeId: string;
	reason: string;
	amount: number;
	currency: string;
	evidenceDueBy?: Date;
}): Promise<void> {
	const { organizationId, disputeId, reason, amount, currency, evidenceDueBy } =
		params;

	try {
		// Get organization name
		const organizationName = await getOrganizationName(organizationId);
		if (!organizationName) {
			logger.error("Organization not found for dispute notification", {
				organizationId,
			});
			return;
		}

		// Get all admins
		const admins = await getOrganizationAdmins(organizationId);
		if (admins.length === 0) {
			logger.warn("No admins found for organization", { organizationId });
			return;
		}

		// Format amount
		const formattedAmount = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount / 100);

		// Format evidence due date if available
		const formattedDueBy = evidenceDueBy
			? evidenceDueBy.toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				})
			: "Unknown";

		// Build Stripe dashboard link for dispute
		const disputeLink = `https://dashboard.stripe.com/disputes/${disputeId}`;

		// Log warning - disputes are critical
		logger.warn("Sending dispute notification", {
			organizationId,
			disputeId,
			reason,
			amount: formattedAmount,
			evidenceDueBy: formattedDueBy,
			recipientCount: admins.length,
		});

		// Send email to all admins
		const emailPromises = admins.map((admin) =>
			sendDisputeReceivedEmail({
				recipient: admin.email,
				appName: appConfig.appName,
				organizationName,
				recipientName: admin.name,
				amount: formattedAmount,
				currency,
				disputeId,
				reason,
				evidenceDueBy: formattedDueBy,
				disputeLink,
			}),
		);

		await Promise.allSettled(emailPromises);

		logger.info("Dispute notifications sent", {
			organizationId,
			recipientCount: admins.length,
		});
	} catch (error) {
		logger.error("Failed to send dispute notifications", {
			organizationId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}
