import "server-only";

import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const getSession = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
		query: {
			disableCookieCache: true,
		},
	});

	return session;
});

export const getActiveSessions = cache(async () => {
	const sessions = await auth.api.listSessions({
		headers: await headers(),
	});

	return sessions;
});

export const getOrganizationById = cache(async (id: string) => {
	try {
		const activeOrganization = await auth.api.getFullOrganization({
			query: {
				organizationId: id,
			},
			headers: await headers(),
		});

		return activeOrganization;
	} catch (error) {
		logger.debug({ error, organizationId: id }, "Failed to get organization");
		return null;
	}
});

export async function assertUserIsOrgMember(
	organizationId: string,
	userId: string,
) {
	const organization = await getOrganizationById(organizationId);
	if (!organization) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Organization not found",
		});
	}

	const membership = organization.members.find((m) => m.userId === userId);
	if (!membership) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Not a member of the organization",
		});
	}

	return { organization, membership };
}

export const getOrganizationList = cache(async () => {
	try {
		const organizationList = await auth.api.listOrganizations({
			headers: await headers(),
		});

		return organizationList;
	} catch (error) {
		logger.debug({ error }, "Failed to list organizations");
		return [];
	}
});

export const getUserAccounts = cache(async () => {
	try {
		const userAccounts = await auth.api.listUserAccounts({
			headers: await headers(),
		});

		return userAccounts;
	} catch (error) {
		logger.debug({ error }, "Failed to list user accounts");
		return [];
	}
});
