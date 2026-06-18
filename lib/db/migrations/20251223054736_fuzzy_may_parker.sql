CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"expires_at" timestamp with time zone,
	"password" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"title" text,
	"messages" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chat_has_owner" CHECK ("ai_chat"."organization_id" IS NOT NULL OR "ai_chat"."user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "billing_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"subscription_id" text,
	"order_id" uuid,
	"event_data" text,
	"processed" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_event_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "credit_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_purchased" integer DEFAULT 0 NOT NULL,
	"lifetime_granted" integer DEFAULT 0 NOT NULL,
	"lifetime_used" integer DEFAULT 0 NOT NULL,
	"lifetime_expired" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_balance_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "credit_deduction_failure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"error_code" text NOT NULL,
	"error_message" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"reference_type" text,
	"reference_id" text,
	"user_id" uuid,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"reference_type" text,
	"reference_id" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_by" uuid,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"job_title" text,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'other' NOT NULL,
	"estimated_value" integer,
	"notes" text,
	"assigned_to_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"stripe_price_id" text NOT NULL,
	"stripe_product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"total_amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"metadata" text,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" uuid,
	"active_organization_id" uuid,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_item" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"stripe_product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_amount" integer,
	"price_type" text DEFAULT 'recurring' NOT NULL,
	"price_model" text DEFAULT 'flat' NOT NULL,
	"interval" text,
	"interval_count" integer DEFAULT 1,
	"meter_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"status" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"stripe_product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"interval" text NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_event" ADD CONSTRAINT "billing_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_deduction_failure" ADD CONSTRAINT "credit_deduction_failure_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_deduction_failure" ADD CONSTRAINT "credit_deduction_failure_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_deduction_failure" ADD CONSTRAINT "credit_deduction_failure_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_user_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "ai_chat_organization_id_idx" ON "ai_chat" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_chat_user_id_idx" ON "ai_chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_chat_created_at_idx" ON "ai_chat" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "billing_event_organization_id_idx" ON "billing_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_event_event_type_idx" ON "billing_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "billing_event_subscription_id_idx" ON "billing_event" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_event_created_at_idx" ON "billing_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_balance_organization_id_idx" ON "credit_balance" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "credit_deduction_failure_org_idx" ON "credit_deduction_failure" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "credit_deduction_failure_resolved_idx" ON "credit_deduction_failure" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "credit_deduction_failure_created_idx" ON "credit_deduction_failure" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_transaction_organization_id_idx" ON "credit_transaction" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "credit_transaction_type_idx" ON "credit_transaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_transaction_created_at_idx" ON "credit_transaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_transaction_reference_idx" ON "credit_transaction" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "credit_transaction_org_created_idx" ON "credit_transaction" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_transaction_org_type_idx" ON "credit_transaction" USING btree ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transaction_checkout_unique" ON "credit_transaction" USING btree ("reference_type","reference_id") WHERE "credit_transaction"."reference_type" = 'checkout_session';--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transaction_bonus_unique" ON "credit_transaction" USING btree ("reference_type","reference_id") WHERE "credit_transaction"."reference_type" = 'checkout_session_bonus';--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_status_idx" ON "invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitation_expires_at_idx" ON "invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invitation_inviter_id_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "lead_organization_id_idx" ON "lead" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lead_status_idx" ON "lead" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lead_source_idx" ON "lead" USING btree ("source");--> statement-breakpoint
CREATE INDEX "lead_assigned_to_id_idx" ON "lead" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "lead_email_idx" ON "lead" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lead_created_at_idx" ON "lead" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_org_status_idx" ON "lead" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_org_idx" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_role_idx" ON "member" USING btree ("role");--> statement-breakpoint
CREATE INDEX "order_item_order_id_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_stripe_price_id_idx" ON "order_item" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "order_organization_id_idx" ON "order" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "order_stripe_customer_id_idx" ON "order" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_payment_intent_id_idx" ON "order" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "order_checkout_session_id_idx" ON "order" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organization_name_idx" ON "organization" USING btree ("name");--> statement-breakpoint
CREATE INDEX "organization_stripe_customer_id_idx" ON "organization" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_active_organization_id_idx" ON "session" USING btree ("active_organization_id");--> statement-breakpoint
CREATE INDEX "subscription_item_subscription_id_idx" ON "subscription_item" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_item_stripe_price_id_idx" ON "subscription_item" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "subscription_item_price_model_idx" ON "subscription_item" USING btree ("price_model");--> statement-breakpoint
CREATE INDEX "subscription_organization_id_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_customer_id_idx" ON "subscription" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_stripe_price_id_idx" ON "subscription" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "subscription_org_status_idx" ON "subscription" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_banned_idx" ON "user" USING btree ("banned");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_value_idx" ON "verification" USING btree ("value");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");