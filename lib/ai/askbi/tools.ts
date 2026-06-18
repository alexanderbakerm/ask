import "server-only";

import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import type { DataSourceRow } from "@/lib/datasources/service";
import type { QueryColumn } from "@/lib/datasources/types";
import { db } from "@/lib/db";
import { catalogTableTable } from "@/lib/db/schema";
import { parseJsonField } from "@/lib/utils/parse-json-field";
import { executeAskBiQuery } from "./execute";
import { rankCatalog, type SourceCatalog } from "./retrieve-catalog";
import type { RunBudget } from "./run-budget";
import { chooseViz } from "./viz/choose-viz";
import type { AskBiAnswer, FieldRole } from "./viz/spec";

// Rows handed back to the MODEL are a small preview (it reasons over shape, not
// the full set); chooseViz uses the full server-side result.
const ROW_PREVIEW = 20;

interface LastResult {
	sql: string;
	columns: QueryColumn[];
	rows: Record<string, unknown>[];
	truncated: boolean;
	outputRoles: Record<string, FieldRole>;
}

export interface AskBiRunContext {
	question?: string;
	catalog?: SourceCatalog;
	/** True once any searchCatalog call matched ≥1 table (grounding succeeded). */
	grounded: boolean;
	lastResult?: LastResult;
	finalAnswer?: AskBiAnswer;
}

export interface AskBiToolDeps {
	dataSource: DataSourceRow;
	budget: RunBudget;
	context: AskBiRunContext;
	userId?: string;
	chatId?: string;
}

/** Build a `SourceCatalog` from the persisted catalog rows (server-only). */
export async function loadSourceCatalog(
	dataSourceId: string,
): Promise<SourceCatalog> {
	const tables = await db.query.catalogTableTable.findMany({
		where: eq(catalogTableTable.dataSourceId, dataSourceId),
		with: { columns: true },
	});
	return {
		tables: tables.map((t) => ({
			schema: t.schemaName,
			name: t.tableName,
			description: t.description,
			rowCountEstimate: t.rowCountEstimate,
			foreignKeys: parseJsonField<
				SourceCatalog["tables"][number]["foreignKeys"]
			>(t.foreignKeys, []),
			columns: t.columns.map((c) => ({
				name: c.columnName,
				dataType: c.dataType,
				normalizedType: c.normalizedType,
				isNullable: c.isNullable,
				isPrimaryKey: c.isPrimaryKey,
				description: c.description,
				synonyms: c.synonyms
					? parseJsonField<string[]>(c.synonyms, [])
					: undefined,
				distinctCount: c.distinctCount,
				sampleValues: c.sampleValues
					? parseJsonField<string[]>(c.sampleValues, [])
					: undefined,
			})),
		})),
	};
}

export function createAskBiTools(deps: AskBiToolDeps) {
	const { dataSource, budget, context } = deps;

	const searchCatalog = tool({
		description:
			"Find the tables and columns relevant to the user's question. ALWAYS call this before writing any SQL.",
		inputSchema: z.object({
			query: z
				.string()
				.describe("the question, or the key entities/metrics to look for"),
		}),
		execute: async ({ query }) => {
			if (!context.catalog) {
				context.catalog = await loadSourceCatalog(dataSource.id);
			}
			const retrieved = rankCatalog(context.catalog, query);
			if (retrieved.matchedTableCount > 0) {
				context.grounded = true;
			}
			if (retrieved.matchedTableCount === 0) {
				return {
					found: false,
					message:
						"No tables in this source match that question. Tell the user you couldn't find data for it — do not write SQL.",
				};
			}
			return {
				found: true,
				tables: retrieved.tables.map((t) => ({
					schema: t.schema,
					name: t.name,
					description: t.description ?? undefined,
					columns: t.columns.map((c) => ({
						name: c.name,
						type: c.normalizedType,
						pk: c.isPrimaryKey || undefined,
						nullable: c.isNullable || undefined,
						sampleValues: c.sampleValues,
					})),
					foreignKeys: t.foreignKeys.map(
						(fk) =>
							`${fk.column} -> ${fk.referencesSchema}.${fk.referencesTable}.${fk.referencesColumn}`,
					),
				})),
			};
		},
	});

	const runQuery = tool({
		description:
			"Validate and run a single read-only SELECT against the data source. Returns columns and a preview of rows, or a structured error explaining what to fix.",
		inputSchema: z.object({
			sql: z
				.string()
				.describe("a single read-only SELECT for the source's SQL dialect"),
		}),
		execute: async ({ sql }) => {
			// Grounding miss: never attempt SQL (and never spend repair budget).
			if (!context.grounded) {
				return {
					ok: false as const,
					terminal: true,
					error:
						"No matching data was found in this source for the question. Stop and tell the user you couldn't find data — do not keep trying.",
					category: "grounding",
				};
			}
			if (budget.timedOut()) {
				return {
					ok: false as const,
					terminal: true,
					error:
						"The request is taking too long. Tell the user and suggest a narrower question.",
					category: "timeout",
				};
			}
			if (budget.sqlAttemptsExhausted()) {
				return {
					ok: false as const,
					terminal: true,
					error:
						"Too many query attempts. Stop and explain you couldn't build a working query.",
					category: "budget",
				};
			}

			budget.recordSqlAttempt();
			const result = await executeAskBiQuery({
				dataSource,
				sql,
				question: context.question,
				userId: deps.userId,
				chatId: deps.chatId,
			});

			if (result.status === "success") {
				context.lastResult = {
					sql,
					columns: result.columns,
					rows: result.rows,
					truncated: result.truncated,
					outputRoles: result.outputRoles,
				};
				return {
					ok: true as const,
					columns: result.columns.map((c) => c.name),
					rowCount: result.rowCount,
					truncated: result.truncated,
					rows: result.rows.slice(0, ROW_PREVIEW),
				};
			}

			// Failure: pass the ACTIONABLE detail (which table/column, the sanitized
			// execution error) back to the model — informed repair, not blind retry.
			const canRetry = budget.canRepair({ retryable: result.retryable });
			return {
				ok: false as const,
				error: result.error,
				category: result.category,
				retryable: canRetry,
				terminal: !canRetry,
			};
		},
	});

	const presentAnswer = tool({
		description:
			"Render the final answer as a chart from your most recent successful query. Call this once you have the result to show.",
		inputSchema: z.object({
			title: z.string().describe("a concise chart title"),
			intent: z
				.enum([
					"trend",
					"comparison",
					"partToWhole",
					"correlation",
					"distribution",
					"detail",
				])
				.optional()
				.describe(
					"advisory hint only; the chart type is chosen deterministically",
				),
		}),
		execute: async ({ title, intent }) => {
			const last = context.lastResult;
			if (!last) {
				return {
					ok: false as const,
					error: "No query result to present yet. Run a query first.",
				};
			}
			const answer = chooseViz({
				columns: last.columns,
				rows: last.rows,
				sql: last.sql,
				truncated: last.truncated,
				intent,
				title,
				roleHints: last.outputRoles,
			});
			context.finalAnswer = answer;
			return answer;
		},
	});

	return { searchCatalog, runQuery, presentAnswer };
}
