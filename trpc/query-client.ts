import {
	defaultShouldDehydrateQuery,
	hashKey,
	QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";
import { getOrganizationScope } from "@/trpc/organization-scope";

/**
 * Prefix used to namespace organization-scoped query keys.
 * This makes it easy to identify scoped keys in debugging tools.
 */
const ORG_SCOPE_PREFIX = "__org__" as const;

/**
 * Routers that contain organization-specific data and should be scoped.
 *
 * These routers use `protectedOrganizationProcedure` and return data
 * that is specific to an organization (e.g., leads, org billing, org credits).
 *
 * Routers NOT in this list are user-scoped and should NOT be org-prefixed:
 * - `user`: User profile, session, settings (same across all orgs)
 * - `admin`: Admin panel data (platform-level, not org-specific)
 * - `uploads`: File uploads (handled separately)
 * - `contact`: Contact form (public)
 */
const ORG_SCOPED_ROUTERS = ["organization"] as const;

/**
 * Procedures under org-scoped routers that should NOT be scoped.
 * These return user-level data that's the same across all organizations.
 *
 * - `organization.list`: Returns all orgs a user belongs to (user-scoped)
 */
const USER_SCOPED_PROCEDURES = ["list"] as const;

/**
 * Checks if a query key corresponds to an organization-scoped router.
 *
 * tRPC query keys follow the pattern: [routerName, procedureName, ...]
 * We only want to scope queries under organization-specific routers,
 * excluding certain user-level procedures like `organization.list`.
 *
 * @param queryKey - The query key array from TanStack Query
 * @returns true if this query should be org-scoped
 */
function isOrganizationScopedQuery(queryKey: readonly unknown[]): boolean {
	// tRPC query keys start with an array containing the path segments
	// e.g., [["organization", "leads", "getAll"], { input: ..., type: "query" }]
	const firstElement = queryKey[0];

	// Handle tRPC v11 format: first element is an array of path segments
	if (Array.isArray(firstElement) && firstElement.length > 0) {
		const routerName = firstElement[0];
		const procedureName = firstElement[1];

		// Check if it's an org-scoped router
		const isOrgRouter =
			typeof routerName === "string" &&
			ORG_SCOPED_ROUTERS.includes(
				routerName as (typeof ORG_SCOPED_ROUTERS)[number],
			);

		// Exclude user-scoped procedures (e.g., organization.list)
		const isUserScopedProcedure =
			typeof procedureName === "string" &&
			USER_SCOPED_PROCEDURES.includes(
				procedureName as (typeof USER_SCOPED_PROCEDURES)[number],
			);

		return isOrgRouter && !isUserScopedProcedure;
	}

	// Handle legacy format or direct query keys: first element is the router name
	if (typeof firstElement === "string") {
		return ORG_SCOPED_ROUTERS.includes(
			firstElement as (typeof ORG_SCOPED_ROUTERS)[number],
		);
	}

	return false;
}

/**
 * Custom query key hash function that includes the organization ID for org-scoped queries.
 *
 * This ensures complete cache isolation between organizations by creating
 * unique cache entries for each org. Without this, queries like:
 *   ["organization", "leads", "getAll", { limit: 10 }]
 * would share the same cache across all organizations.
 *
 * With this function, organization-scoped queries become:
 *   ["__org__", "org_123abc", "organization", "leads", "getAll", { limit: 10 }]
 *
 * User-level queries (user.*, organizations.*, admin.*) are NOT scoped,
 * avoiding duplicate caching of identical data per organization.
 *
 * This approach is recommended by TanStack Query maintainers for multi-tenant apps.
 * @see https://github.com/TanStack/query/discussions/3743
 *
 * @param queryKey - The original query key array
 * @returns A stable hash string for the (optionally scoped) query key
 */
function organizationScopedQueryKeyHashFn(
	queryKey: readonly unknown[],
): string {
	const organizationId = getOrganizationScope();

	// If no organization is active, use the original key
	if (!organizationId) {
		return hashKey(queryKey);
	}

	// Only scope queries under organization-specific routers
	// User-level queries (user.*, organizations.*, admin.*) remain unscoped
	if (!isOrganizationScopedQuery(queryKey)) {
		return hashKey(queryKey);
	}

	// Prefix the query key with org scope for complete isolation
	const scopedKey = [ORG_SCOPE_PREFIX, organizationId, ...queryKey];
	return hashKey(scopedKey);
}

/**
 * Clears only organization-scoped queries from the query cache.
 *
 * This is useful when switching organizations to clear stale data without
 * causing flickering by also removing user-level queries (like the list of
 * organizations) that don't need to be refetched.
 *
 * @param queryClient - The QueryClient instance to clear queries from
 */
export function clearOrganizationScopedQueries(queryClient: QueryClient): void {
	queryClient.removeQueries({
		predicate: (query) => isOrganizationScopedQuery(query.queryKey),
	});
}

/**
 * Creates a new QueryClient with organization-scoped query key hashing.
 *
 * The custom queryKeyHashFn ensures that:
 * 1. Queries from different organizations never share cache entries
 * 2. Switching organizations automatically uses different cache keys
 * 3. No race conditions or timing windows for data leakage
 *
 * @returns A configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: 30 * 1000,
				// Organization-scoped query key hashing for multi-tenant isolation
				queryKeyHashFn: organizationScopedQueryKeyHashFn,
			},
			mutations: {
				retry: false,
			},
			dehydrate: {
				serializeData: superjson.serialize,
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
			},
			hydrate: {
				deserializeData: superjson.deserialize,
			},
		},
	});
}
