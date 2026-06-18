import "server-only";

import { DataSourceType } from "@/lib/db/schema/enums";
import {
	type PostgresConnectionParams,
	PostgresConnector,
} from "./postgres-connector";
import type { DataSourceConnector } from "./types";

/**
 * Build a connector for a data source type. PostgreSQL is the engine; an
 * imported CSV is loaded into a Postgres table the app owns (see csv-loader.ts),
 * so a `csv` source is queried through the SAME PostgresConnector + read-only
 * role — every validator and the execute chokepoint apply unchanged. MySQL /
 * Excel arrive on their own tracks.
 */
export function createConnector(
	type: DataSourceType,
	params: PostgresConnectionParams,
): DataSourceConnector {
	switch (type) {
		case DataSourceType.postgres:
		case DataSourceType.csv:
			return new PostgresConnector(params);
		case DataSourceType.mysql:
		case DataSourceType.excel:
			throw new Error(`Data source type "${type}" is not implemented yet`);
		default:
			throw new Error(`Unknown data source type: ${type}`);
	}
}

export { PostgresConnector };
export type { PostgresConnectionParams };
