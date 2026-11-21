CREATE TYPE "public"."maintenance_category" AS ENUM('plumbing', 'electrical', 'furniture', 'appliance', 'internet', 'cleaning', 'other');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('open', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "maintenance_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_comment_body" CHECK (length(trim("maintenance_comment"."body")) between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "maintenance_comment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "maintenance_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"unit_id" uuid,
	"resident_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"category" "maintenance_category" DEFAULT 'other' NOT NULL,
	"priority" "maintenance_priority" DEFAULT 'normal' NOT NULL,
	"status" "maintenance_status" DEFAULT 'open' NOT NULL,
	"photo_path" text,
	"assignee" text,
	"cost" numeric(10, 2),
	"blocks_unit" boolean DEFAULT false NOT NULL,
	"reported_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "maintenance_request_photoPath_unique" UNIQUE("photo_path"),
	CONSTRAINT "maintenance_request_title" CHECK (length(trim("maintenance_request"."title")) between 1 and 120),
	CONSTRAINT "maintenance_request_description" CHECK ("maintenance_request"."description" is null or length("maintenance_request"."description") <= 2000),
	CONSTRAINT "maintenance_request_cost" CHECK ("maintenance_request"."cost" is null or "maintenance_request"."cost" >= 0),
	CONSTRAINT "maintenance_request_resolved_at" CHECK (("maintenance_request"."status" in ('done', 'cancelled')) = ("maintenance_request"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "maintenance_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "maintenance_comment" ADD CONSTRAINT "maintenance_comment_request_id_maintenance_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."maintenance_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_comment" ADD CONSTRAINT "maintenance_comment_author_id_person_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_reported_by_person_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_comment_request_id_idx" ON "maintenance_comment" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "maintenance_request_business_status_idx" ON "maintenance_request" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "maintenance_request_unit_id_idx" ON "maintenance_request" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "maintenance_request_resident_id_idx" ON "maintenance_request" USING btree ("resident_id");--> statement-breakpoint
CREATE POLICY "maintenance_comment_landlord_all" ON "maintenance_comment" AS PERMISSIVE FOR ALL TO "authenticated" USING ("maintenance_comment"."request_id" in (select m.id from public.maintenance_request m where m.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("maintenance_comment"."request_id" in (select m.id from public.maintenance_request m where m.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) and "maintenance_comment"."author_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "maintenance_comment_select_own" ON "maintenance_comment" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("maintenance_comment"."request_id" in (select m.id from public.maintenance_request m where m.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "maintenance_comment_insert_own" ON "maintenance_comment" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("maintenance_comment"."request_id" in (select m.id from public.maintenance_request m where m.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))) and "maintenance_comment"."author_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "maintenance_request_landlord_all" ON "maintenance_request" AS PERMISSIVE FOR ALL TO "authenticated" USING ("maintenance_request"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("maintenance_request"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "maintenance_request_select_own" ON "maintenance_request" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("maintenance_request"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "maintenance_request_insert_own" ON "maintenance_request" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("maintenance_request"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))) and "maintenance_request"."reported_by" in (select id from public.person where user_id = (select auth.uid()))
        and "maintenance_request"."business_id" = (select r.business_id from public.resident r where r.id = "maintenance_request"."resident_id")
        and "maintenance_request"."status" = 'open' and "maintenance_request"."cost" is null and "maintenance_request"."assignee" is null and "maintenance_request"."blocks_unit" = false
        and ("maintenance_request"."unit_id" is null or "maintenance_request"."unit_id" in (select c.unit_id from public.contract c where c.resident_id = "maintenance_request"."resident_id")));