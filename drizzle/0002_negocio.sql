CREATE TYPE "public"."business_kind" AS ENUM('natural', 'company');--> statement-breakpoint
CREATE TYPE "public"."business_service" AS ENUM('residence', 'meal_plan');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('yape', 'plin', 'transfer', 'cash', 'card');--> statement-breakpoint
CREATE TABLE "business" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"service" "business_service" NOT NULL,
	"kind" "business_kind" NOT NULL,
	"trade_name" text NOT NULL,
	"legal_name" text,
	"ruc" text,
	"phone" text,
	"contact_email" text,
	"city" text,
	"address" text,
	"payment_methods" "payment_method"[] DEFAULT '{}' NOT NULL,
	"billing_day" smallint,
	CONSTRAINT "business_ruc_format" CHECK ("business"."ruc" is null or "business"."ruc" ~ '^[0-9]{11}$'),
	CONSTRAINT "business_billing_day_range" CHECK ("business"."billing_day" is null or "business"."billing_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "business" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "property_owner_id_idx";--> statement-breakpoint
ALTER TABLE "property" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "business" ADD CONSTRAINT "business_owner_id_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_owner_id_idx" ON "business" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_business_id_idx" ON "property" USING btree ("business_id");--> statement-breakpoint
CREATE POLICY "business_owner_all" ON "business" AS PERMISSIVE FOR ALL TO "authenticated" USING ("business"."owner_id" in (select id from public.person where user_id = (select auth.uid()))) WITH CHECK ("business"."owner_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
ALTER POLICY "floor_owner_all" ON "floor" TO authenticated USING (exists (select 1 from public.property p where p.id = "floor"."property_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK (exists (select 1 from public.property p where p.id = "floor"."property_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
ALTER POLICY "property_owner_all" ON "property" TO authenticated USING ("property"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("property"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
ALTER POLICY "unit_owner_all" ON "unit" TO authenticated USING (exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = "unit"."floor_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK (exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = "unit"."floor_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));