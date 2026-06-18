import * as Sentry from "@sentry/nextjs";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";
import { assertUserIsOrgMember, getSession } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import type { Context } from "@/trpc/context";

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter: ({ shape, error }) => {
		if (error.code === "INTERNAL_SERVER_ERROR") {
			return {
				...shape,
				message:
					env.NODE_ENV === "development"
						? error.message
						: "Something went wrong",
				cause: env.NODE_ENV === "development" ? error.cause : undefined,
			};
		}
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const sentryMiddleware = t.middleware(
	Sentry.trpcMiddleware({ attachRpcInput: true }),
);

/**
 * Logging middleware that captures procedure calls with user and organization context
 * Sets up Sentry context for better error reporting
 */
const loggingMiddleware = t.middleware(
	async ({ ctx, next, path, type, input }) => {
		const startTime = Date.now();

		// Extract user info from context if available
		const userId = (ctx as { user?: { id?: string } }).user?.id;
		const userEmail = (ctx as { user?: { email?: string } }).user?.email;
		const userRole = (ctx as { user?: { role?: string } }).user?.role;

		// Extract session info from context (available in protectedProcedure)
		const session = (ctx as { session?: { impersonatedBy?: string | null } })
			.session;

		// Extract organizationId from input if available
		const organizationId = (input as { organizationId?: string })
			?.organizationId;

		// Check for impersonation from the session object
		const impersonatedBy = session?.impersonatedBy ?? null;
		const isImpersonated = !!impersonatedBy;

		// Set Sentry context for better error reporting
		const scope = Sentry.getCurrentScope();

		// Set user context
		if (userId) {
			scope.setUser({
				id: userId,
				email: userEmail,
			});
		}

		// Set additional context
		scope.setContext("trpc", {
			procedure: path,
			type,
			organizationId,
			userRole,
			isImpersonated,
			impersonatedBy,
			requestId: ctx.requestId,
		});

		// Set tags for filtering in Sentry
		if (organizationId) {
			scope.setTag("organizationId", organizationId);
		}
		if (userRole) {
			scope.setTag("userRole", userRole);
		}
		if (isImpersonated) {
			scope.setTag("isImpersonated", "true");
			scope.setTag("impersonatedBy", impersonatedBy || "unknown");
		}
		scope.setTag("procedure", path);
		scope.setTag("procedureType", type);

		try {
			const result = await next();
			return result;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Log procedure error with additional data
			logger.error(
				{
					procedure: path,
					type,
					duration,
					success: false,
					error: getErrorMessage(error),
					errorCode: error instanceof TRPCError ? error.code : undefined,
					userId,
					userEmail,
					organizationId,
					requestId: ctx.requestId,
					userAgent: ctx.userAgent,
					ip: ctx.ip,
				},
				"tRPC procedure failed",
			);

			throw error;
		}
	},
);

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure
	.use(loggingMiddleware)
	.use(sentryMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * Also includes the activeOrganizationId from the session for procedures that need it.
 */
export const protectedProcedure = t.procedure
	.use(async ({ ctx, next }) => {
		const session = await getSession();
		if (!session) {
			logger.error("No valid session.");
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "No valid session.",
			});
		}

		const isImpersonating = Boolean(
			"session" in session &&
				"impersonatedBy" in session.session &&
				session.session.impersonatedBy,
		);

		return next({
			ctx: {
				...ctx,
				user: session.user,
				session: session.session,
				activeOrganizationId: session.session.activeOrganizationId ?? null,
				isImpersonating,
			},
		});
	})
	.use(loggingMiddleware)
	.use(sentryMiddleware);

/**
 * Protected (authenticated) admin procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged admins. It verifies
 * the user role is admin.
 *
 */
export const protectedAdminProcedure = protectedProcedure.use(
	({ ctx, next }) => {
		if (ctx.user.role !== "admin") {
			throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
		}

		return next({ ctx });
	},
);

/**
 * Protected organization procedure
 *
 * For procedures that require an active organization. It verifies:
 * 1. User is authenticated
 * 2. There is an active organization in the session
 * 3. User is a member of the active organization
 *
 * Provides ctx.organization with the validated organization and membership.
 */
export const protectedOrganizationProcedure = protectedProcedure.use(
	async ({ ctx, next }) => {
		const { activeOrganizationId } = ctx;

		if (!activeOrganizationId) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "No active organization. Please select an organization first.",
			});
		}

		// Verify user is a member of the organization and get organization details
		const { organization, membership } = await assertUserIsOrgMember(
			activeOrganizationId,
			ctx.user.id,
		);

		return next({
			ctx: {
				...ctx,
				organization,
				membership,
			},
		});
	},
);

/**
 * Protected organization admin procedure
 *
 * Like {@link protectedOrganizationProcedure}, but additionally requires the
 * caller's organization role to be `owner` or `admin`. Use for managing shared
 * org resources (e.g. connecting/editing/deleting data sources) while leaving
 * read/use access to all members.
 */
export const protectedOrganizationAdminProcedure =
	protectedOrganizationProcedure.use(({ ctx, next }) => {
		const role = ctx.membership.role;
		if (role !== "owner" && role !== "admin") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Requires organization owner or admin",
			});
		}
		return next({ ctx });
	});
