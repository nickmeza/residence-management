CREATE TYPE "public"."application_status" AS ENUM('new', 'waitlist', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"unit_type" "unit_type",
	"move_in_date" date,
	"months" smallint,
	"budget" numeric(10, 2),
	"occupation" text,
	"message" text,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"note" text,
	"resident_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "application_full_name" CHECK (length(trim("application"."full_name")) between 2 and 120),
	CONSTRAINT "application_message" CHECK ("application"."message" is null or length("application"."message") <= 1000),
	CONSTRAINT "application_months" CHECK ("application"."months" is null or "application"."months" between 1 and 60),
	CONSTRAINT "application_budget" CHECK ("application"."budget" is null or "application"."budget" >= 0)
);
--> statement-breakpoint
ALTER TABLE "application" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business" ADD COLUMN "accepts_applications" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_business_created_idx" ON "application" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE POLICY "application_landlord_all" ON "application" AS PERMISSIVE FOR ALL TO "authenticated" USING ("application"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("application"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));