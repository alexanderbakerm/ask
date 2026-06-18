import "server-only";

import { eq } from "drizzle-orm";
import { sanitizeDbError } from "@/lib/datasources/errors";
import {
	type DataSourceRow,
	getConnectorForSource,
} from "@/lib/datasources/service";
import {
	DEFAULT_QUERY_LIMITS,
	type QueryColumn,
	type SqlDialect,
} from "@/lib/datasources/types";
import { db } from "@/lib/db";
import { catalogTableTable, queryRunTable } from "@/lib/db/schema";
import { type DataSourceType, QueryRunStatus } from "@/lib/db/schema/enums";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import {
	analyzeSql,
	type SqlAnalysis,
	type ValidationCatalog,
	validateAgainstCatalog,
} from "./validate-against-catalog";
import { validateReadOnlySql } from "./validate-sql";
import type { FieldRole } from "./viz/spec";

/**
 * THE single guarded path from a generated SQL string to the database.
 *
 * The agent only ever produces a string and calls this; it has no other route
 * to a connector. Here, before the connector is touched, BOTH validators run
 * (SELECT-only AST + catalog grounding), and a validator *throwing* fails
 * closed to a rejection. Every attempt — rejected, errored, timed out, or
 * successful — is written to `query_run` (the audit log). Connector errors are
 * sanitized before they reach the audit log or the agent; raw detail goes only
 * to the server logger. The `outputRoles` returned come from the exact SQL
 * that was validated and executed, so they match what actually ran.
 */

export type ExecuteFailureCategory =
	| "select_only"
	| "catalog"
	| "parse"
	| "execution"
	| "timeout"
	| "internal";

export interface ExecuteParams {
	dataSource: DataSourceRow;
	sql: string;
	/** The NL question, for the audit log. */
	question?: string;
	userId?: string;
	chatId?: string;
	maxRows?: number;
	timeoutMs?: number;
}

export interface ExecuteSuccess {
	status: "success";
	queryRunId: string;
	columns: QueryColumn[];
	rows: Record<string, unknown>[];
	rowCount: number;
	truncated: boolean;
	durationMs: number;
	/** Structure-derived roles for the exact executed SQL (for chooseViz). */
	outputRoles: Record<string, FieldRole>;
}

export interface ExecuteFailure {
	status: "validation_rejected" | "execution_error" | "timeout";
	queryRunId: string;
	/** Sanitized, safe to show / feed to the agent for repair. */
	error: string;
	/**
	 * Whether the agent should attempt a repair. Structured (not flattened into
	 * an opaque string) so the loop can branch on retryable vs not.
	 */
	retryable: boolean;
	category: ExecuteFailureCategory;
}

export type ExecuteResult = ExecuteSuccess | ExecuteFailure;

export function dialectForType(type: DataSourceType): SqlDialect {
	// `csv` (and `excel`) sources are loaded into a Postgres table the app owns,
	// so they speak the Postgres dialect — same validator + connector path.
	if (type === "postgres" || type === "csv" || type === "excel") {
		return "postgresql";
	}
	if (type === "mysql") return "mysql";
	throw new Error(`Unsupported data source type for AskBI: ${type}`);
}

function looksLikeTimeout(error: unknown): boolean {
	const e = error as { code?: unknown; message?: unknown };
	if (e?.code === "57014") return true;
	return (
		typeof e?.message === "string" &&
		/statement timeout|canceling statement/i.test(e.message)
	);
}

async function loadValidationCatalog(
	dataSourceId: string,
): Promise<ValidationCatalog> {
	const tables = await db.query.catalogTableTable.findMany({
		where: eq(catalogTableTable.dataSourceId, dataSourceId),
		with: { columns: true },
	});
	return {
		tables: tables.map((t) => ({
			schema: t.schemaName,
			table: t.tableName,
			columns: t.columns.map((c) => c.columnName),
		})),
	};
}

export async function executeAskBiQuery(
	params: ExecuteParams,
): Promise<ExecuteResult> {
	const { dataSource, sql, question, userId, chatId } = params;
	const maxRows = params.maxRows ?? DEFAULT_QUERY_LIMITS.maxRows;
	const timeoutMs = params.timeoutMs ?? DEFAULT_QUERY_LIMITS.timeoutMs;
	const organizationId = dataSource.organizationId;
	const dialect = dialectForType(dataSource.type);

	const record = async (
		status: QueryRunStatus,
		fields: {
			error?: string | null;
			rowCount?: number | null;
			durationMs?: number | null;
			truncated?: boolean;
		},
	): Promise<string> => {
		const [row] = await db
			.insert(queryRunTable)
			.values({
				organizationId,
				dataSourceId: dataSource.id,
				userId: userId ?? null,
				chatId: chatId ?? null,
				question: question ?? null,
				generatedSql: sql,
				status,
				rowCount: fields.rowCount ?? null,
				durationMs: fields.durationMs ?? null,
				truncated: fields.truncated ?? false,
				error: fields.error ?? null,
			})
			.returning({ id: queryRunTable.id });
		return row?.id ?? "";
	};

	// ---- Validation (runs before the connector; fails closed on a throw) ----
	let analysis: SqlAnalysis | undefined;
	try {
		const selectOnly = validateReadOnlySql(sql, dialect);
		if (!selectOnly.ok) {
			const queryRunId = await record(QueryRunStatus.validationRejected, {
				error: selectOnly.reason,
			});
			return {
				status: "validation_rejected",
				queryRunId,
				error:
					selectOnly.reason ?? "Only read-only SELECT queries are allowed.",
				retryable: true,
				category: "select_only",
			};
		}

		analysis = analyzeSql(sql, dialect);
		if (!analysis.ok) {
			const queryRunId = await record(QueryRunStatus.validationRejected, {
				error: analysis.parseError ?? "Could not parse SQL",
			});
			return {
				status: "validation_rejected",
				queryRunId,
				error: "The query could not be parsed.",
				retryable: true,
				category: "parse",
			};
		}

		const catalog = await loadValidationCatalog(dataSource.id);
		const catalogCheck = validateAgainstCatalog(analysis, catalog);
		if (!catalogCheck.ok) {
			const queryRunId = await record(QueryRunStatus.validationRejected, {
				error: catalogCheck.reason,
			});
			return {
				status: "validation_rejected",
				queryRunId,
				error: catalogCheck.reason ?? "Query references unknown schema.",
				retryable: true,
				category: "catalog",
			};
		}
	} catch (error) {
		// Fail closed: any validator throw aborts to rejection — never the connector.
		logger.error(
			{ error: getErrorMessage(error) },
			"AskBI validation threw — failing closed",
		);
		const queryRunId = await record(QueryRunStatus.validationRejected, {
			error: "Validation error",
		});
		return {
			status: "validation_rejected",
			queryRunId,
			error: "The query could not be validated.",
			retryable: false,
			category: "internal",
		};
	}

	if (!analysis) {
		const queryRunId = await record(QueryRunStatus.validationRejected, {
			error: "Validation error",
		});
		return {
			status: "validation_rejected",
			queryRunId,
			error: "The query could not be validated.",
			retryable: false,
			category: "internal",
		};
	}

	// ---- Execution (the ONLY place that reaches the connector) ----
	const connector = getConnectorForSource(dataSource);
	const start = Date.now();
	try {
		const result = await connector.runQuery(sql, { maxRows, timeoutMs });
		const queryRunId = await record(QueryRunStatus.success, {
			rowCount: result.rowCount,
			durationMs: result.durationMs,
			truncated: result.truncated,
		});
		return {
			status: "success",
			queryRunId,
			columns: result.columns,
			rows: result.rows,
			rowCount: result.rowCount,
			truncated: result.truncated,
			durationMs: result.durationMs,
			outputRoles: analysis.outputRoles,
		};
	} catch (error) {
		const timedOut = looksLikeTimeout(error);
		const sanitized = sanitizeDbError(error);
		// Raw detail to the server logger only; sanitized everywhere else.
		logger.debug(
			{ error: getErrorMessage(error), dataSourceId: dataSource.id },
			"AskBI query execution failed",
		);
		const queryRunId = await record(
			timedOut ? QueryRunStatus.timeout : QueryRunStatus.executionError,
			{ error: sanitized, durationMs: Date.now() - start },
		);
		return {
			status: timedOut ? "timeout" : "execution_error",
			queryRunId,
			error: sanitized,
			retryable: true,
			category: timedOut ? "timeout" : "execution",
		};
	} finally {
		await connector.close();
	}
}
