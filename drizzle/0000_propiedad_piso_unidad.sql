CREATE TYPE "public"."bathroom_type" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('room', 'floor', 'building');--> statement-breakpoint
CREATE TYPE "public"."rental_mode" AS ENUM('whole', 'by_room');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('apartment', 'room');--> statement-breakpoint
CREATE TABLE "floor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"outline" jsonb NOT NULL,
	CONSTRAINT "floor_outline_min_corners" CHECK (jsonb_typeof("floor"."outline") = 'array' and jsonb_array_length("floor"."outline") >= 4)
);
--> statement-breakpoint
ALTER TABLE "floor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	CONSTRAINT "person_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "person" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"district_city" text NOT NULL,
	"type" "property_type" NOT NULL,
	"owner_lives_here" boolean DEFAULT false NOT NULL,
	"manager_id" uuid,
	"currency" text DEFAULT 'PEN' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"parent_unit_id" uuid,
	"type" "unit_type" NOT NULL,
	"name" text NOT NULL,
	"occupies_whole_floor" boolean DEFAULT false NOT NULL,
	"rental_mode" "rental_mode",
	"monthly_price" numeric(10, 2),
	"area_m_2" numeric(8, 2),
	"bathroom" "bathroom_type",
	"furnished" boolean DEFAULT false NOT NULL,
	"pos_x" numeric(8, 2) NOT NULL,
	"pos_z" numeric(8, 2) NOT NULL,
	"width" numeric(8, 2) NOT NULL,
	"depth" numeric(8, 2) NOT NULL,
	CONSTRAINT "unit_apartment_fields" CHECK (("unit"."type" = 'apartment' and "unit"."rental_mode" is not null)
        or ("unit"."type" = 'room' and "unit"."rental_mode" is null and "unit"."occupies_whole_floor" = false)),
	CONSTRAINT "unit_by_room_without_price" CHECK ("unit"."rental_mode" is distinct from 'by_room' or "unit"."monthly_price" is null),
	CONSTRAINT "unit_parent_only_rooms" CHECK ("unit"."parent_unit_id" is null or "unit"."type" = 'room'),
	CONSTRAINT "unit_positive_size" CHECK ("unit"."width" > 0 and "unit"."depth" > 0),
	CONSTRAINT "unit_price_not_negative" CHECK ("unit"."monthly_price" is null or "unit"."monthly_price" >= 0),
	CONSTRAINT "unit_area_positive" CHECK ("unit"."area_m_2" is null or "unit"."area_m_2" > 0)
);
--> statement-breakpoint
ALTER TABLE "unit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "floor" ADD CONSTRAINT "floor_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_owner_id_person_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_manager_id_person_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_floor_id_floor_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_parent_unit_id_unit_id_fk" FOREIGN KEY ("parent_unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "floor_property_id_idx" ON "floor" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_owner_id_idx" ON "property" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "unit_floor_id_idx" ON "unit" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "unit_parent_unit_id_idx" ON "unit" USING btree ("parent_unit_id");--> statement-breakpoint
CREATE POLICY "floor_owner_all" ON "floor" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from public.property p where p.id = "floor"."property_id" and p.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK (exists (select 1 from public.property p where p.id = "floor"."property_id" and p.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "person_select_own" ON "person" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("person"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "person_update_own" ON "person" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("person"."user_id" = (select auth.uid())) WITH CHECK ("person"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "property_owner_all" ON "property" AS PERMISSIVE FOR ALL TO "authenticated" USING ("property"."owner_id" in (select id from public.person where user_id = (select auth.uid()))) WITH CHECK ("property"."owner_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "unit_owner_all" ON "unit" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = "unit"."floor_id" and p.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK (exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = "unit"."floor_id" and p.owner_id in (select id from public.person where user_id = (select auth.uid()))));