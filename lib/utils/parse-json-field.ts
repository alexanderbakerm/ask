/** Parse JSON text from the DB; return fallback on null/invalid (never throw). */
export function parseJsonField<T>(
	raw: string | null | undefined,
	fallback: T,
): T {
	if (!raw) {
		return fallback;
	}
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}
