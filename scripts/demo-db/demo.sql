-- AskBI demo dataset + read-only role.
--
-- Runs INSIDE the `askbi_demo` database (the database itself is created by the
-- seeder / initdb step, since CREATE DATABASE cannot run here). Idempotent:
-- safe to re-run — it drops and rebuilds the `sales` schema.
--
-- Two things this file deliberately demonstrates:
--   1. The demo data lives in a NON-public schema (`sales`) so connecting the
--      source exercises AskBI's schema-qualified introspection / scoping.
--   2. A genuinely airtight, REVIEWABLE read-only grant (below). The role can
--      CONNECT, USE the schema, and SELECT — nothing else. No CREATE anywhere,
--      no TEMP objects, and it owns nothing (the superuser owns the objects).

-- ---------------------------------------------------------------------------
-- 1) Read-only login role (self-contained so this file can be applied directly)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'askbi_readonly') THEN
		CREATE ROLE askbi_readonly LOGIN PASSWORD 'askbi_readonly_password';
	ELSE
		ALTER ROLE askbi_readonly WITH LOGIN PASSWORD 'askbi_readonly_password';
	END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) Demo schema + data (in `sales`, not `public`)
-- ---------------------------------------------------------------------------
DROP SCHEMA IF EXISTS sales CASCADE;
CREATE SCHEMA sales;

CREATE TABLE sales.products (
	id         serial PRIMARY KEY,
	name       text NOT NULL,
	category   text NOT NULL,            -- low-cardinality dimension for charts
	unit_price numeric(10, 2) NOT NULL
);

CREATE TABLE sales.orders (
	id         serial PRIMARY KEY,
	product_id integer NOT NULL REFERENCES sales.products (id),
	order_date date NOT NULL,
	quantity   integer NOT NULL,
	amount     numeric(12, 2) NOT NULL
);
CREATE INDEX orders_order_date_idx ON sales.orders (order_date);
CREATE INDEX orders_product_id_idx ON sales.orders (product_id);

INSERT INTO sales.products (name, category, unit_price) VALUES
	('Aurora Laptop',     'Hardware',     1200.00),
	('Nimbus Keyboard',   'Hardware',       80.00),
	('Pulse Monitor',     'Hardware',      300.00),
	('Insight Analytics', 'Software',      200.00),
	('FlowState IDE',     'Software',      120.00),
	('Cable Bundle',      'Accessories',    15.00),
	('Travel Case',       'Accessories',    45.00);

-- Orders across all of 2025: ~4 per product per month, with month-level
-- variation and a clear Q4 holiday bump, so "sales of Q4 for product X" and the
-- follow-up "break that down by month" both have real granularity.
INSERT INTO sales.orders (product_id, order_date, quantity, amount)
SELECT
	p.id,
	(
		date '2025-01-01'
		+ ((m - 1) * interval '1 month')
		+ ((d * 7 - 6) * interval '1 day')
	)::date AS order_date,
	q.quantity,
	round(
		(
			p.unit_price * q.quantity
			* CASE
				WHEN m IN (11, 12) THEN 1.6   -- holiday peak
				WHEN m = 10        THEN 1.3   -- Q4 ramp-up
				WHEN m IN (6, 7)   THEN 1.15  -- summer
				ELSE 1.0
			END
			* (0.85 + ((p.id * 7 + m * 13 + d * 5) % 30) / 100.0)  -- per-row jitter
		)::numeric,
		2
	) AS amount
FROM sales.products p
CROSS JOIN generate_series(1, 12) AS m   -- months
CROSS JOIN generate_series(1, 4) AS d    -- orders per product per month
CROSS JOIN LATERAL (
	SELECT 1 + ((p.id + m + d) % 5) AS quantity
) AS q;

-- ---------------------------------------------------------------------------
-- 2b) A SECOND, deliberately DIFFERENT dataset: web analytics (`web` schema).
--     Same DB, separate schema — connect a second AskBI data source scoped to
--     `web` to see the auto-dashboard adapt (sessions/sources/devices, not
--     products/orders) and produce a visibly different mix of tiles.
-- ---------------------------------------------------------------------------
DROP SCHEMA IF EXISTS web CASCADE;
CREATE SCHEMA web;

CREATE TABLE web.sources (
	id      serial PRIMARY KEY,
	name    text NOT NULL,            -- low-cardinality dimension (acquisition source)
	channel text NOT NULL
);

CREATE TABLE web.sessions (
	id               serial PRIMARY KEY,
	source_id        integer NOT NULL REFERENCES web.sources (id),
	started_at       date NOT NULL,
	device           text NOT NULL,   -- Desktop / Mobile / Tablet
	country          text NOT NULL,   -- US / UK / DE / IN / BR
	pageviews        integer NOT NULL,
	duration_seconds integer NOT NULL,
	is_bounce        boolean NOT NULL,
	revenue          numeric(10, 2) NOT NULL
);
CREATE INDEX sessions_started_at_idx ON web.sessions (started_at);
CREATE INDEX sessions_source_id_idx ON web.sessions (source_id);

INSERT INTO web.sources (name, channel) VALUES
	('Organic Search', 'Search'),
	('Paid Search',    'Paid'),
	('Direct',         'Direct'),
	('Referral',       'Referral'),
	('Social',         'Social');

-- Daily-ish sessions across 2025: one row per (source, month, sample day), with
-- a growth trend and per-source/seasonal variation so trends, breakdowns, and a
-- source × month heatmap all have real, dense signal.
INSERT INTO web.sessions (source_id, started_at, device, country, pageviews, duration_seconds, is_bounce, revenue)
SELECT
	s.id,
	(date '2025-01-01' + ((m - 1) * interval '1 month') + ((d - 1) * interval '1 day'))::date AS started_at,
	(ARRAY['Desktop','Mobile','Tablet'])[1 + ((s.id + d) % 3)] AS device,
	(ARRAY['US','UK','DE','IN','BR'])[1 + ((s.id * 3 + d) % 5)] AS country,
	(20 + ((s.id * 7 + m * 5 + d) % 40))                            -- pageviews
		* CASE WHEN m >= 9 THEN 2 ELSE 1 END AS pageviews,          -- H2 growth
	(40 + ((s.id * 11 + d * 13) % 200)) AS duration_seconds,
	(((s.id + d) % 4) = 0) AS is_bounce,                            -- ~25% bounce
	round(
		(
			(5 + ((s.id * 13 + m * 7 + d) % 60))
			* CASE
				WHEN s.id = 2 THEN 1.8   -- Paid Search converts harder
				WHEN s.id = 1 THEN 1.3   -- Organic strong
				ELSE 1.0
			END
			* CASE WHEN m IN (11, 12) THEN 1.5 WHEN m >= 9 THEN 1.25 ELSE 1.0 END
		)::numeric,
		2
	) AS revenue
FROM web.sources s
CROSS JOIN generate_series(1, 12) AS m         -- months
CROSS JOIN generate_series(1, 24) AS d;        -- sample days per month

-- ---------------------------------------------------------------------------
-- 3) Airtight read-only grant (do NOT rely on PUBLIC defaults — they differ
--    across Postgres versions, so revoke explicitly).
-- ---------------------------------------------------------------------------
-- Strip PUBLIC's default CONNECT + TEMP on the database, then grant only CONNECT.
REVOKE ALL ON DATABASE askbi_demo FROM PUBLIC;
GRANT CONNECT ON DATABASE askbi_demo TO askbi_readonly;

-- No object creation anywhere (covers the version-dependent PUBLIC/CREATE grant).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA sales FROM PUBLIC;

REVOKE ALL ON SCHEMA web FROM PUBLIC;

-- The role may use the schemas and read their tables — current and future.
GRANT USAGE ON SCHEMA sales TO askbi_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO askbi_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales GRANT SELECT ON TABLES TO askbi_readonly;

GRANT USAGE ON SCHEMA web TO askbi_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA web TO askbi_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA web GRANT SELECT ON TABLES TO askbi_readonly;
