import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
	admin,
	captcha,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import { authConfig } from "@/config/auth.config";
import { getOrganizationPlanLimits } from "@/lib/billing/guards";
import { syncOrganizationSeats } from "@/lib/billing/seat-sync";
import { db, userTable } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { InvitationStatus } from "@/lib/db/schema/enums";
import {
	sendConfirmEmailAddressChangeEmail,
	sendOrganizationInvitationEmail,
	sendPasswordResetEmail,
	sendVerifyEmailAddressEmail,
} from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

const appUrl = getBaseUrl();

export const auth = betterAuth({
	baseURL: appUrl,
	trustedOrigins: authConfig.trustedOrigins,
	appName: appConfig.appName,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			...schema,
			account: schema.accountTable,
			invitation: schema.invitationTable,
			member: schema.memberTable,
			organization: schema.organizationTable,
			session: schema.sessionTable,
			twoFactor: schema.twoFactorTable,
			user: schema.userTable,
			verification: schema.verificationTable,
		},
	}),
	advanced: {
		database: {
			generateId: false,
		},
	},
	session: {
		expiresIn: authConfig.sessionCookieMaxAge,
		freshAge: 0,
	},
	user: {
		additionalFields: {
			onboardingComplete: {
				type: "boolean",
				required: false,
			},
			banned: {
				type: "boolean",
				required: false,
			},
			banReason: {
				type: "string",
				required: false,
			},
			banExpires: {
				type: "date",
				required: false,
			},
		},
		deleteUser: {
			enabled: true,
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async (
				{ user: { email, name }, url },
				_request,
			) => {
				await sendConfirmEmailAddressChangeEmail({
					recipient: email,
					name,
					confirmLink: url,
				});
			},
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
		},
	},
	emailAndPassword: {
		enabled: true,
		// If signup is enabled, we can't auto sign in the user, as the email is not verified yet.
		autoSignIn: false,
		requireEmailVerification: true,
		minPasswordLength: authConfig.minimumPasswordLength,
		sendResetPassword: async ({ user, url }, _request) => {
			await sendPasswordResetEmail({
				recipient: user.email,
				appName: appConfig.appName,
				name: user.name,
				resetPasswordLink: url,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		expiresIn: authConfig.verificationExpiresIn,
		sendVerificationEmail: async ({ user: { email, name }, url }, _request) => {
			await sendVerifyEmailAddressEmail({
				recipient: email,
				name,
				verificationLink: url,
			});
		},
	},
	socialProviders: {
		google: {
			prompt: "select_account",
			clientId: env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
			scope: ["email", "profile"],
		},
	},
	plugins: [
		username(),
		admin(),
		...(env.TURNSTILE_SECRET_KEY
			? [
					captcha({
						provider: "cloudflare-turnstile",
						secretKey: env.TURNSTILE_SECRET_KEY,
					}),
				]
			: []),
		organization({
			sendInvitationEmail: async (
				{ email, inviter, id, organization },
				_request,
			) => {
				// Check member limit before allowing invitation
				// Count current members + pending invitations against plan limit
				const [currentMembers, pendingInvitations, planLimits] =
					await Promise.all([
						db
							.select({ id: schema.memberTable.id })
							.from(schema.memberTable)
							.where(eq(schema.memberTable.organizationId, organization.id)),
						db
							.select({ id: schema.invitationTable.id })
							.from(schema.invitationTable)
							.where(
								and(
									eq(schema.invitationTable.organizationId, organization.id),
									eq(schema.invitationTable.status, InvitationStatus.pending),
								),
							),
						getOrganizationPlanLimits(organization.id),
					]);

				const totalPotentialMembers =
					currentMembers.length + pendingInvitations.length;

				// -1 means unlimited
				if (
					planLimits.maxMembers !== -1 &&
					totalPotentialMembers >= planLimits.maxMembers
				) {
					throw new APIError("FORBIDDEN", {
						message: `You have reached the maximum number of team members (${planLimits.maxMembers}) for your plan. Please upgrade to invite more members.`,
					});
				}

				const existingUser = await db.query.userTable.findFirst({
					where: (user, { eq }) => eq(user.email, email),
				});

				const url = new URL(
					existingUser ? "/auth/sign-in" : "/auth/sign-up",
					getBaseUrl(),
				);

				url.searchParams.set("invitationId", id);
				url.searchParams.set("email", email);

				const inviterUser = await db.query.userTable.findFirst({
					where: (user, { eq }) => eq(user.id, inviter.userId),
				});

				await sendOrganizationInvitationEmail({
					recipient: email,
					appName: appConfig.appName,
					organizationName: organization.name,
					invitedByEmail: inviterUser?.email ?? "",
					invitedByName: inviterUser?.name ?? "",
					inviteLink: url.toString(),
				});
			},
			// Organization hooks for seat-based billing synchronization
			organizationHooks: {
				// Sync seats after a member is added (via direct add or invitation acceptance)
				afterAddMember: async ({ organization }) => {
					try {
						await syncOrganizationSeats(organization.id);
						logger.info("Synced seats after member added", {
							organizationId: organization.id,
						});
					} catch (error) {
						// Log but don't throw - member was added successfully,
						// seat sync can be retried or will be fixed by next sync
						logger.error("Failed to sync seats after member added", {
							organizationId: organization.id,
							error: error instanceof Error ? error.message : "Unknown error",
						});
					}
				},
				// Sync seats after a member is removed
				afterRemoveMember: async ({ organization }) => {
					try {
						await syncOrganizationSeats(organization.id);
						logger.info("Synced seats after member removed", {
							organizationId: organization.id,
						});
					} catch (error) {
						// Log but don't throw - member was removed successfully,
						// seat sync can be retried or will be fixed by next sync
						logger.error("Failed to sync seats after member removed", {
							organizationId: organization.id,
							error: error instanceof Error ? error.message : "Unknown error",
						});
					}
				},
				// Sync seats after invitation is accepted (member joins)
				afterAcceptInvitation: async ({ organization }) => {
					try {
						await syncOrganizationSeats(organization.id);
						logger.info("Synced seats after invitation accepted", {
							organizationId: organization.id,
						});
					} catch (error) {
						logger.error("Failed to sync seats after invitation accepted", {
							organizationId: organization.id,
							error: error instanceof Error ? error.message : "Unknown error",
						});
					}
				},
			},
		}),
		openAPI(),
		twoFactor(),
	],
	databaseHooks: {
		session: {
			create: {
				async before(session, ctx) {
					// Check if user is banned when creating a session
					const targetUser = await db.query.userTable.findFirst({
						where: (users, { eq }) => eq(users.id, session.userId),
					});

					if (targetUser?.banned) {
						// Check if ban has expired
						if (
							targetUser.banExpires &&
							new Date(targetUser.banExpires) < new Date()
						) {
							// Update user to unban
							await db
								.update(userTable)
								.set({
									banned: false,
									banReason: null,
									banExpires: null,
								})
								.where(eq(userTable.id, targetUser.id));
						} else {
							// User is still banned
							let message =
								targetUser.banReason || "Your account has been suspended";
							if (targetUser.banExpires) {
								const expiryDate = new Date(
									targetUser.banExpires,
								).toLocaleDateString("en-US", {
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								});
								message += `|expires:${expiryDate}`;
							}
							throw new APIError("FORBIDDEN", {
								code: "USER_BANNED",
								message,
							});
						}
					}

					return { ...ctx, data: session };
				},
			},
		},
	},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path === "/sign-up/email" || ctx.path === "/sign-in/email") {
				// Check if user is banned when signing in
				if (ctx.path === "/sign-in/email") {
					const targetUser = await db.query.userTable.findFirst({
						where: (users, { eq }) => eq(users.email, ctx.body?.email),
					});

					if (targetUser?.banned) {
						// Check if ban has expired
						if (
							targetUser.banExpires &&
							new Date(targetUser.banExpires) < new Date()
						) {
							// Update user to unban
							await db
								.update(userTable)
								.set({
									banned: false,
									banReason: null,
									banExpires: null,
								})
								.where(eq(userTable.id, targetUser.id));
						} else {
							// User is still banned
							let message =
								targetUser.banReason || "Your account has been suspended";
							if (targetUser.banExpires) {
								const expiryDate = new Date(
									targetUser.banExpires,
								).toLocaleDateString("en-US", {
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								});
								message += `|expires:${expiryDate}`;
							}
							throw new APIError("FORBIDDEN", {
								code: "USER_BANNED",
								message,
							});
						}
					}
				}
			}
		}),
	},
	onAPIError: {
		onError(error, ctx) {
			logger.error(error, "auth error", ctx);
		},
	},
});
