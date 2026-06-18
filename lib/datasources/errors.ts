/**
 * Sanitize a database/driver error into a message that is safe to persist in
 * the audit log and return to the client.
 *
 * Driver errors routinely echo connection identity — host/IP, port, user,
 * dbname — especially during connect/auth. We map well-known SQLSTATE / Node
 * error codes to generic text and, as a fallback, redact host/IP/credential
 * fragments from the raw message. The audit log should record *that* a query
 * failed, not a string containing where it ran or who ran it.
 *
 * Pure (no DB / env), unit-testable in isolation.
 */

const CODE_MESSAGES: Record<string, string> = {
	// PostgreSQL SQLSTATE
	"28P01": "Authentication failed",
	"28000": "Authentication failed",
	"3D000": "Database not found",
	"3F000": "Schema not found",
	"08006": "Could not connect to the database",
	"08001": "Could not connect to the database",
	"08004": "The database rejected the connection",
	"53300": "Too many database connections",
	"57014": "Query exceeded the statement timeout",
	"25006": "Write rejected: the connection is read-only",
	"42501": "Permission denied by the database",
	// Node / socket / TLS
	ECONNREFUSED: "Could not reach the database host",
	ENOTFOUND: "Could not resolve the database host",
	EHOSTUNREACH: "Could not reach the database host",
	ETIMEDOUT: "Connection to the database timed out",
	ECONNRESET: "The database connection was reset",
	CERT_HAS_EXPIRED: "The database TLS certificate has expired",
	DEPTH_ZERO_SELF_SIGNED_CERT:
		"The database is using a self-signed TLS certificate",
};

export function sanitizeDbError(error: unknown): string {
	const err =
		error && typeof error === "object"
			? (error as { code?: unknown; message?: unknown })
			: null;

	const code = typeof err?.code === "string" ? err.code : undefined;
	if (code && CODE_MESSAGES[code]) {
		return CODE_MESSAGES[code];
	}

	const raw =
		typeof err?.message === "string" && err.message.length > 0
			? err.message
			: "Database error";

	const redacted = raw
		// IPv4 addresses
		.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[redacted-host]")
		// IPv6-ish runs of hextets
		.replace(/\b(?:[0-9a-f]{1,4}:){2,}[0-9a-f]{0,4}\b/gi, "[redacted-host]")
		// key=value connection fragments
		.replace(
			/\b(host|hostaddr|port|user|dbname|password)\s*=\s*\S+/gi,
			"$1=[redacted]",
		)
		// quoted role/user names (e.g. 'role "reporting_user" does not exist')
		.replace(/\b(user|role)\s+"[^"]*"/gi, '$1 "[redacted]"')
		.trim();

	return (redacted.length > 0 ? redacted : "Database error").slice(0, 500);
}
