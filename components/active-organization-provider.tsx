"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";
import type { getOrganizationById } from "@/lib/auth/server";

/**
 * Provider that syncs the active organization from server to Better Auth session.
 * When the organization layout loads, it passes the organization from the session
 * to this provider, which ensures the client-side session is in sync.
 *
 * The actual organization data is then available via useActiveOrganization() hook
 * which reads from Better Auth's session.
 */
export function ActiveOrganizationProvider({
	organization,
	children,
}: React.PropsWithChildren<{
	organization: NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>;
}>): React.JSX.Element {
	const { session } = useSession();
	const hasSyncedRef = useRef(false);

	// When this provider mounts with an organization (from server session),
	// ensure the client-side session is in sync
	useEffect(() => {
		// Only sync if:
		// 1. We have an organization ID
		// 2. We haven't already synced in this mount (to prevent loops)
		// 3. The current client session has a different active organization
		if (
			organization?.id &&
			!hasSyncedRef.current &&
			session?.activeOrganizationId !== organization.id
		) {
			hasSyncedRef.current = true;

			// Set the active organization in Better Auth session
			// This ensures the client-side session stays in sync with the server
			// Fire-and-forget: errors are silently ignored as this is a sync operation
			// and the server session is the source of truth
			authClient.organization
				.setActive({
					organizationId: organization.id,
				})
				.catch(() => {
					// Silently ignore - server session is source of truth
					hasSyncedRef.current = false;
				});
		}
	}, [organization?.id, session?.activeOrganizationId]);

	return <>{children}</>;
}
