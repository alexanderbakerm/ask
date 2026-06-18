# AskBI demo database

A self-contained, read-only PostgreSQL source for exercising AskBI end-to-end —
including all three SELECT-only layers at once (the DB read-only **grant**, the
connector's read-only **transaction**, and the **AST validator**).

It lives as a separate database (`askbi_demo`) on the **same** Postgres instance
the app uses, with a dedicated `askbi_readonly` login role. Demo tables are in a
non-`public` schema (`sales`) on purpose, so connecting the source is a real test
of AskBI's schema-qualified introspection.

## Setup

```bash
docker compose up -d        # start Postgres (the existing app instance)
npm run db:demo             # create + seed askbi_demo, apply the read-only grant
```

`npm run db:demo` is idempotent — re-run it any time to reset the demo data.

## Connect it in AskBI

Add a data source with these values (note the **read-only** role and the `sales`
schema):

| Field    | Value                      |
| -------- | -------------------------- |
| Host     | `localhost`                |
| Port     | `5432`                     |
| Database | `askbi_demo`               |
| User     | `askbi_readonly`           |
| Password | `askbi_readonly_password`  |
| Schema   | `sales`                    |
| SSL      | off                        |

## What's inside

- `sales.products` — 7 products across 3 categories (`Hardware`, `Software`,
  `Accessories`); `category` is the low-cardinality dimension for charts.
- `sales.orders` — ~336 orders across all of 2025 with month-level variation and
  a Q4 holiday bump, so the definition-of-done flow works with real granularity:
  _"sales of Q4 for product X"_ → _"break that down by month"_.

## The grant (`demo.sql`)

The read-only grant is version-controlled and intentionally airtight — see
`demo.sql`. `askbi_readonly` may only `CONNECT`, `USAGE` the `sales` schema, and
`SELECT` its tables (current and future). It has no `CREATE` anywhere, no `TEMP`,
and owns nothing. So writes are refused at the database layer, independent of the
application's validator and read-only transaction.
