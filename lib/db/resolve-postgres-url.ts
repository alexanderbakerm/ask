/**
 * Pick a Postgres connection URL that works from serverless (Vercel).
 * Supabase integrations often set POSTGRES_HOST / DATABASE_URL to
 * db.<ref>.supabase.co, which does not resolve on Vercel — the pooler URL does.
 */

export function parsePostgresUrl(urlString: string): URL {
	return new URL(urlString.replace(/^postgres:\/\//, "postgresql://"));
}

/** Direct Supabase DB host — unreachable from many serverless runtimes. */
export function isUnreachableSupabaseDirectHost(host: string): boolean {
	return /^db\.[a-z0-9]+\.supabase\.co$/i.test(host);
}

export function isLocalHost(host: string): boolean {
	return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isUsablePostgresUrl(urlString: string): boolean {
	try {
		const host = parsePostgresUrl(urlString).hostname;
		return !isUnreachableSupabaseDirectHost(host);
	} catch {
		return false;
	}
}

/** First env URL whose host is not the broken direct Supabase hostname. */
export function resolvePostgresConnectionUrl(): string | undefined {
	const candidates = [
		process.env.DATABASE_URL,
		process.env.POSTGRES_URL_NON_POOLING,
		process.env.POSTGRES_URL,
		process.env.POSTGRES_PRISMA_URL,
	];

	for (const url of candidates) {
		if (url && isUsablePostgresUrl(url)) {
			return url;
		}
	}

	return undefined;
}
