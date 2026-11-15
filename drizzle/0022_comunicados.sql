CREATE TYPE "public"."announcement_audience" AS ENUM('all', 'property', 'floor', 'resident');--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"audience" "announcement_audience" NOT NULL,
	"property_id" uuid,
	"floor_id" uuid,
	"resident_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_title" CHECK (length(trim("announcement"."title")) between 1 and 120),
	CONSTRAINT "announcement_body" CHECK (length(trim("announcement"."body")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "announcement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_floor_id_floor_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_business_created_idx" ON "announcement" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE POLICY "announcement_landlord_all" ON "announcement" AS PERMISSIVE FOR ALL TO "authenticated" USING ("announcement"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("announcement"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));