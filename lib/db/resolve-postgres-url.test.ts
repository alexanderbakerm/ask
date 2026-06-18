import { afterEach, describe, expect, it } from "vitest";
import {
	formatSupabasePoolerUser,
	isSupabasePoolerHost,
	normalizePostgresPoolerUser,
	resolvePostgresConnectionUrl,
	resolveSupabaseProjectRef,
} from "./resolve-postgres-url";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

describe("isSupabasePoolerHost", () => {
	it("detects Supavisor pooler hosts", () => {
		expect(isSupabasePoolerHost("aws-1-us-east-1.pooler.supabase.com")).toBe(
			true,
		);
		expect(isSupabasePoolerHost("localhost")).toBe(false);
	});
});

describe("formatSupabasePoolerUser", () => {
	it("appends project ref for bare usernames", () => {
		expect(
			formatSupabasePoolerUser("askbi_readonly", "snapovzobizllwooiugr"),
		).toBe("askbi_readonly.snapovzobizllwooiugr");
	});

	it("does not double-append when suffix already present", () => {
		expect(
			formatSupabasePoolerUser(
				"postgres.snapovzobizllwooiugr",
				"snapovzobizllwooiugr",
			),
		).toBe("postgres.snapovzobizllwooiugr");
	});
});

describe("normalizePostgresPoolerUser", () => {
	it("leaves non-pooler hosts unchanged", () => {
		expect(
			normalizePostgresPoolerUser("localhost", "askbi_readonly", "abc123"),
		).toBe("askbi_readonly");
	});

	it("uses env project ref on pooler hosts", () => {
		process.env.POSTGRES_URL =
			"postgresql://postgres.snapovzobizllwooiugr:secret@aws-1-us-east-1.pooler.supabase.com:6543/postgres";
		expect(
			normalizePostgresPoolerUser(
				"aws-1-us-east-1.pooler.supabase.com",
				"askbi_readonly",
			),
		).toBe("askbi_readonly.snapovzobizllwooiugr");
	});

	it("prefers explicit project ref from stored config", () => {
		expect(
			normalizePostgresPoolerUser(
				"aws-1-us-east-1.pooler.supabase.com",
				"askbi_readonly",
				"snapovzobizllwooiugr",
			),
		).toBe("askbi_readonly.snapovzobizllwooiugr");
	});
});

describe("resolvePostgresConnectionUrl", () => {
	it("prefers transaction pooler (6543) over session pooler (5432)", () => {
		process.env.DATABASE_URL = "";
		process.env.POSTGRES_URL =
			"postgresql://postgres.snapovzobizllwooiugr:secret@aws-1-us-east-1.pooler.supabase.com:6543/postgres";
		process.env.POSTGRES_URL_NON_POOLING =
			"postgresql://postgres.snapovzobizllwooiugr:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
		expect(resolvePostgresConnectionUrl()).toBe(process.env.POSTGRES_URL);
	});

	it("falls back to session pooler when transaction pooler is unavailable", () => {
		delete process.env.DATABASE_URL;
		delete process.env.POSTGRES_URL;
		process.env.POSTGRES_URL_NON_POOLING =
			"postgresql://postgres.snapovzobizllwooiugr:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
		expect(resolvePostgresConnectionUrl()).toBe(
			process.env.POSTGRES_URL_NON_POOLING,
		);
	});
});

describe("resolveSupabaseProjectRef", () => {
	it("reads ref from pooler URL username", () => {
		process.env.POSTGRES_URL =
			"postgresql://postgres.snapovzobizllwooiugr:secret@aws-1-us-east-1.pooler.supabase.com:6543/postgres";
		expect(resolveSupabaseProjectRef()).toBe("snapovzobizllwooiugr");
	});

	it("reads ref from direct POSTGRES_HOST", () => {
		delete process.env.POSTGRES_URL;
		process.env.POSTGRES_HOST = "db.snapovzobizllwooiugr.supabase.co";
		expect(resolveSupabaseProjectRef()).toBe("snapovzobizllwooiugr");
	});
});
