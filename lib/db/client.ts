import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Check the drizzle documentation for more information on how to connect to your preferred database provider
// https://orm.drizzle.team/docs/get-started-postgresql

export const db = drizzle(env.DATABASE_URL, {
	schema,
});
