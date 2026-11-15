CREATE TYPE "public"."move_kind" AS ENUM('check_in', 'check_out');--> statement-breakpoint
CREATE TABLE "move_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"kind" "move_kind" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"keys_count" smallint,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "move_event_keys" CHECK ("move_event"."keys_count" is null or "move_event"."keys_count" between 0 and 20),
	CONSTRAINT "move_event_notes" CHECK ("move_event"."notes" is null or length("move_event"."notes") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "move_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "move_event" ADD CONSTRAINT "move_event_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_event" ADD CONSTRAINT "move_event_updated_by_person_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "move_event_contract_kind_idx" ON "move_event" USING btree ("contract_id","kind");--> statement-breakpoint
CREATE POLICY "move_event_landlord_all" ON "move_event" AS PERMISSIVE FOR ALL TO "authenticated" USING ("move_event"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))) WITH CHECK ("move_event"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "move_event_select_own" ON "move_event" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("move_event"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));