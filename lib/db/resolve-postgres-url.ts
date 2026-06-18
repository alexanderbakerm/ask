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

function isSupabaseTransactionPoolerUrl(urlString: string): boolean {
	try {
		const parsed = parsePostgresUrl(urlString);
		return (
			isSupabasePoolerHost(parsed.hostname) &&
			(parsed.port === "6543" || parsed.port === "")
		);
	} catch {
		return false;
	}
}

/** First env URL whose host is not the broken direct Supabase hostname. */
export function resolvePostgresConnectionUrl(): string | undefined {
	const candidates = [
		process.env.DATABASE_URL,
		process.env.POSTGRES_URL,
		process.env.POSTGRES_URL_NON_POOLING,
		process.env.POSTGRES_PRISMA_URL,
	].filter((url): url is string => !!url && isUsablePostgresUrl(url));

	if (candidates.length === 0) {
		return undefined;
	}

	// Supabase session pooler (5432) caps concurrent clients (~15). Serverless
	// needs transaction pooler (6543) when both are configured.
	const transactionPooler = candidates.find(isSupabaseTransactionPoolerUrl);
	if (transactionPooler) {
		return transactionPooler;
	}

	return candidates[0];
}

/** Supabase Supavisor pooler — requires tenant id via username suffix or SNI. */
export function isSupabasePoolerHost(host: string): boolean {
	return /\.pooler\.supabase\.com$/i.test(host);
}

function projectRefFromSupabaseUser(username: string): string | undefined {
	const dot = username.indexOf(".");
	if (dot <= 0) {
		return undefined;
	}
	const ref = username.slice(dot + 1);
	return /^[a-z0-9]{15,}$/i.test(ref) ? ref : undefined;
}

/** Resolve Supabase project ref from integration env (pooler URLs, direct host, etc.). */
export function resolveSupabaseProjectRef(): string | undefined {
	const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
	if (explicit) {
		return explicit;
	}

	for (const key of [
		"DATABASE_URL",
		"POSTGRES_URL_NON_POOLING",
		"POSTGRES_URL",
		"POSTGRES_PRISMA_URL",
	] as const) {
		const url = process.env[key];
		if (!url) {
			continue;
		}
		try {
			const ref = projectRefFromSupabaseUser(parsePostgresUrl(url).username);
			if (ref) {
				return ref;
			}
		} catch {
			// try next candidate
		}
	}

	const directHost = process.env.POSTGRES_HOST?.trim();
	if (directHost) {
		const match = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(directHost);
		if (match?.[1]) {
			return match[1];
		}
	}

	for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
		const url = process.env[key]?.trim();
		if (!url) {
			continue;
		}
		try {
			const host = new URL(url).hostname;
			const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
			if (match?.[1]) {
				return match[1];
			}
		} catch {
			// try next candidate
		}
	}

	return undefined;
}

/**
 * Supavisor expects `user.project_ref` when connecting to *.pooler.supabase.com
 * without SNI. Role names inside Postgres stay unprefixed; only the login user
 * carries the tenant suffix.
 */
export function formatSupabasePoolerUser(
	user: string,
	projectRef: string,
): string {
	if (!projectRef) {
		return user;
	}
	if (user.endsWith(`.${projectRef}`)) {
		return user;
	}
	if (projectRefFromSupabaseUser(user)) {
		return user;
	}
	return `${user}.${projectRef}`;
}

/** Apply pooler username suffix when host is Supabase Supavisor. */
export function normalizePostgresPoolerUser(
	host: string,
	user: string,
	projectRef?: string,
): string {
	if (!isSupabasePoolerHost(host)) {
		return user;
	}
	const ref = projectRef ?? resolveSupabaseProjectRef();
	if (!ref) {
		return user;
	}
	return formatSupabasePoolerUser(user, ref);
}
