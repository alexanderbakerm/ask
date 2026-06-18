CREATE TABLE "catalog_column" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_table_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"column_name" text NOT NULL,
	"data_type" text NOT NULL,
	"normalized_type" text NOT NULL,
	"is_nullable" boolean DEFAULT true NOT NULL,
	"is_primary_key" boolean DEFAULT false NOT NULL,
	"ordinal_position" integer,
	"description" text,
	"synonyms" text,
	"distinct_count" integer,
	"sample_values" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"schema_name" text DEFAULT 'public' NOT NULL,
	"table_name" text NOT NULL,
	"description" text,
	"row_count_estimate" integer,
	"foreign_keys" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" text,
	"encrypted_credentials" text,
	"last_error" text,
	"last_tested_at" timestamp with time zone,
	"last_introspected_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"data_source_id" uuid,
	"user_id" uuid,
	"chat_id" uuid,
	"question" text,
	"generated_sql" text NOT NULL,
	"status" text NOT NULL,
	"row_count" integer,
	"duration_ms" integer,
	"truncated" boolean DEFAULT false NOT NULL,
	"error" text,
	"credits_consumed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_query" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"data_source_id" uuid,
	"user_id" uuid,
	"name" text NOT NULL,
	"question" text,
	"sql" text NOT NULL,
	"viz_spec" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_column" ADD CONSTRAINT "catalog_column_catalog_table_id_catalog_table_id_fk" FOREIGN KEY ("catalog_table_id") REFERENCES "public"."catalog_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_column" ADD CONSTRAINT "catalog_column_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_table" ADD CONSTRAINT "catalog_table_data_source_id_data_source_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_table" ADD CONSTRAINT "catalog_table_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_run" ADD CONSTRAINT "query_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_run" ADD CONSTRAINT "query_run_data_source_id_data_source_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_run" ADD CONSTRAINT "query_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_run" ADD CONSTRAINT "query_run_chat_id_ai_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."ai_chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_query" ADD CONSTRAINT "saved_query_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_query" ADD CONSTRAINT "saved_query_data_source_id_data_source_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_query" ADD CONSTRAINT "saved_query_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_column_catalog_table_id_idx" ON "catalog_column" USING btree ("catalog_table_id");--> statement-breakpoint
CREATE INDEX "catalog_column_organization_id_idx" ON "catalog_column" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_column_unique_idx" ON "catalog_column" USING btree ("catalog_table_id","column_name");--> statement-breakpoint
CREATE INDEX "catalog_table_data_source_id_idx" ON "catalog_table" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "catalog_table_organization_id_idx" ON "catalog_table" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_table_unique_idx" ON "catalog_table" USING btree ("data_source_id","schema_name","table_name");--> statement-breakpoint
CREATE INDEX "data_source_organization_id_idx" ON "data_source" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_source_type_idx" ON "data_source" USING btree ("type");--> statement-breakpoint
CREATE INDEX "data_source_status_idx" ON "data_source" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_source_org_status_idx" ON "data_source" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "query_run_organization_id_idx" ON "query_run" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "query_run_data_source_id_idx" ON "query_run" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "query_run_user_id_idx" ON "query_run" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "query_run_chat_id_idx" ON "query_run" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "query_run_status_idx" ON "query_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "query_run_created_at_idx" ON "query_run" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "query_run_org_created_idx" ON "query_run" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_query_organization_id_idx" ON "saved_query" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_query_data_source_id_idx" ON "saved_query" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "saved_query_user_id_idx" ON "saved_query" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_query_created_at_idx" ON "saved_query" USING btree ("created_at");