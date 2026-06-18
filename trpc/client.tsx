"use client";

import {
	type QueryClient,
	QueryClientProvider,
	useQueryClient,
} from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useMemo, useRef } from "react";
import superjson from "superjson";
import { env } from "@/lib/env";
import { getBaseUrl } from "@/lib/utils";
import {
	getOrganizationScope,
	setOrganizationScope,
} from "@/trpc/organization-scope";
import {
	clearOrganizationScopedQueries,
	createQueryClient,
} from "@/trpc/query-client";
import type { AppRouter } from "@/trpc/routers/app";

/**
 * tRPC React Query client with full type safety.
 * Use this to call tRPC procedures from React components.
 *
 * @example
 * ```tsx
 * // Query
 * const { data } = trpc.organization.lead.list.useQuery({ limit: 10 });
 *
 * // Mutation
 * const mutation = trpc.organization.lead.create.useMutation();
 * await mutation.mutateAsync({ name: "New Lead" });
 * ```
 *
 * @see https://trpc.io/docs/client/react
 */
export const trpc = createTRPCReact<AppRouter>();

let clientQueryClientSingleton: QueryClient;

function getQueryClient(): QueryClient {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return createQueryClient();
	}
	// Browser: use singleton pattern to keep the same query client
	return (clientQueryClientSingleton ??= createQueryClient());
}

interface TRPCProviderProps {
	children: React.ReactNode;
	/**
	 * The active organization ID from the session.
	 * This is used to scope all query cache keys to the current organization,
	 * ensuring complete data isolation between organizations.
	 *
	 * When this changes (e.g., on page navigation after org switch),
	 * queries will automatically use different cache keys,
	 * preventing any data leakage between organizations.
	 *
	 * Pass `undefined` for unauthenticated users (marketing pages).
	 */
	organizationId?: string | null;
}

/**
 * Internal component to sync organization scope with QueryClient.
 * This needs to be inside TRPCProvider but outside components that use trpc.
 */
function OrgScopeSync({ organizationId }: { organizationId: string | null }) {
	const queryClient = useQueryClient();
	const prevOrgIdRef = useRef<string | null | undefined>(undefined);

	// CRITICAL: Detect organization change BEFORE any state updates
	// The ref tracks the previous value to detect actual changes vs re-renders.
	const orgScopeChanged =
		prevOrgIdRef.current !== undefined &&
		prevOrgIdRef.current !== organizationId;

	// CRITICAL ORDER OF OPERATIONS:
	// 1. Clear cache FIRST (if org changed)
	// 2. Update scope SECOND
	// 3. Update ref THIRD
	//
	// This prevents a race condition where a concurrent render could
	// execute a query with the NEW scope that hits OLD cached data.
	// By clearing the cache before updating the scope, any query that
	// runs will either:
	// - Use the old scope and miss (cache is cleared)
	// - Use the new scope and miss (no data cached yet)
	//
	// Both cases result in a fresh fetch, which is the correct behavior.

	if (orgScopeChanged) {
		clearOrganizationScopedQueries(queryClient);
	}

	if (getOrganizationScope() !== organizationId) {
		setOrganizationScope(organizationId);
	}

	prevOrgIdRef.current = organizationId;

	return null;
}

/**
 * Provider component that sets up tRPC and React Query with organization-scoped caching.
 *
 * Uses the server-side session as the authoritative source for organization ID.
 * Organization switches trigger page navigation, which re-renders the layout
 * with the updated session, ensuring the cache is properly scoped.
 */
export function TRPCProvider({
	children,
	organizationId: propOrganizationId,
}: TRPCProviderProps) {
	// Use the organization ID from the server-side session directly.
	// This is the authoritative source - organization switches trigger page navigation,
	// which re-renders the root layout with the updated session.
	// No need for a reactive client-side hook that causes 401 errors on marketing pages.
	const organizationId = propOrganizationId ?? null;

	const queryClient = getQueryClient();

	// Create tRPC client - memoized since it doesn't need to change
	const trpcClient = useMemo(
		() =>
			trpc.createClient({
				links: [
					loggerLink({
						enabled: () => env.NEXT_PUBLIC_NODE_ENV === "development",
					}),
					httpBatchLink({
						transformer: superjson,
						url: `${getBaseUrl()}/api/trpc`,
					}),
				],
			}),
		[],
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<OrgScopeSync organizationId={organizationId} />
				{children}
			</QueryClientProvider>
		</trpc.Provider>
	);
}
