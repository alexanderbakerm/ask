/**
 * Organization Scope Store
 *
 * Manages the current organization ID for query key hashing.
 * This ensures complete cache isolation between organizations by including
 * the organization ID in all query key hashes.
 *
 * WHY THIS EXISTS:
 * Without organization-scoped query keys, switching organizations can cause:
 * 1. Cache collisions - queries from different orgs share the same cache key
 * 2. Data leakage - stale data from org A shown when viewing org B
 * 3. Race conditions - useEffect-based cache clearing has a timing window
 *
 * By including the org ID in the query key hash, queries from different
 * organizations are stored under completely different cache entries,
 * making data leakage impossible.
 *
 * @warning SSR SAFETY: This module uses global state and is ONLY safe for
 * client-side usage. In Next.js App Router, module-level variables persist
 * across requests on the server, which could leak organization context between
 * different users' requests. However, this is safe because:
 *
 * 1. The TRPCProvider component that calls these functions is a "use client"
 *    component, so this code only runs in the browser.
 * 2. The QueryClient is created fresh for each server request (see query-client.ts),
 *    so server-side queries don't use this scope.
 *
 * Server components should NOT import this module directly.
 *
 * @see https://tanstack.com/query/v5/docs/react/guides/query-keys
 */

/**
 * The current organization ID used for scoping all query keys.
 * null means no organization is active (user-level queries only).
 */
let currentOrganizationId: string | null = null;

/**
 * Gets the current organization ID used for query key scoping.
 * @returns The current organization ID or null if none is active
 */
export function getOrganizationScope(): string | null {
	return currentOrganizationId;
}

/**
 * Sets the current organization ID for query key scoping.
 * This should be called synchronously when the organization changes,
 * BEFORE any queries are executed, to ensure proper cache isolation.
 *
 * @param organizationId - The new organization ID, or null to clear
 */
export function setOrganizationScope(organizationId: string | null): void {
	currentOrganizationId = organizationId;
}
