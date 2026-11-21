CREATE TYPE "public"."cleaning_request_status" AS ENUM('requested', 'scheduled', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cleaning_status" AS ENUM('clean', 'dirty', 'inspected');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('maintenance', 'cleaning');--> statement-breakpoint
CREATE TYPE "public"."task_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "cleaning_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"unit_id" uuid,
	"note" text,
	"preferred_date" date,
	"status" "cleaning_request_status" DEFAULT 'requested' NOT NULL,
	"scheduled_for" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "cleaning_request_note" CHECK ("cleaning_request"."note" is null or length("cleaning_request"."note") <= 500),
	CONSTRAINT "cleaning_request_done_at" CHECK (("cleaning_request"."status" = 'done') = ("cleaning_request"."done_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "cleaning_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"from_resident" boolean NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "message_body" CHECK (length(trim("message"."body")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "parcel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"description" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"delivered_to" text,
	"created_by" uuid NOT NULL,
	CONSTRAINT "parcel_description" CHECK (length(trim("parcel"."description")) between 1 and 120),
	CONSTRAINT "parcel_delivered_to" CHECK ("parcel"."delivered_to" is null or length("parcel"."delivered_to") <= 120)
);
--> statement-breakpoint
ALTER TABLE "parcel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" "task_kind" NOT NULL,
	"title" text NOT NULL,
	"place" text,
	"property_id" uuid,
	"every" smallint NOT NULL,
	"period" "task_period" NOT NULL,
	"next_due" date NOT NULL,
	"supplier_id" uuid,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_task_title" CHECK (length(trim("recurring_task"."title")) between 1 and 120),
	CONSTRAINT "recurring_task_place" CHECK ("recurring_task"."place" is null or length("recurring_task"."place") <= 120),
	CONSTRAINT "recurring_task_every" CHECK ("recurring_task"."every" between 1 and 365),
	CONSTRAINT "recurring_task_notes" CHECK ("recurring_task"."notes" is null or length("recurring_task"."notes") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "recurring_task" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"room" smallint NOT NULL,
	"cleaning" smallint NOT NULL,
	"treatment" smallint NOT NULL,
	"coexistence" smallint NOT NULL,
	"meal_plan" smallint,
	"comment" text,
	"recommends" boolean NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_contractId_unique" UNIQUE("contract_id"),
	CONSTRAINT "review_scores" CHECK ("review"."room" between 1 and 5 and "review"."cleaning" between 1 and 5 and "review"."treatment" between 1 and 5
        and "review"."coexistence" between 1 and 5 and ("review"."meal_plan" is null or "review"."meal_plan" between 1 and 5)),
	CONSTRAINT "review_comment" CHECK ("review"."comment" is null or length("review"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "review" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trade" text,
	"phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_name" CHECK (length(trim("supplier"."name")) between 2 and 120),
	CONSTRAINT "supplier_trade" CHECK ("supplier"."trade" is null or length("supplier"."trade") <= 60),
	CONSTRAINT "supplier_phone" CHECK ("supplier"."phone" is null or length("supplier"."phone") <= 30),
	CONSTRAINT "supplier_note" CHECK ("supplier"."note" is null or length("supplier"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "supplier" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"done_on" date NOT NULL,
	"cost" numeric(10, 2),
	"supplier_id" uuid,
	"note" text,
	"done_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_log_cost" CHECK ("task_log"."cost" is null or "task_log"."cost" >= 0),
	CONSTRAINT "task_log_note" CHECK ("task_log"."note" is null or length("task_log"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "task_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"resident_id" uuid,
	"visitor_name" text NOT NULL,
	"arrived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"note" text,
	"created_by" uuid NOT NULL,
	CONSTRAINT "visit_visitor_name" CHECK (length(trim("visit"."visitor_name")) between 2 and 120),
	CONSTRAINT "visit_note" CHECK ("visit"."note" is null or length("visit"."note") <= 300),
	CONSTRAINT "visit_left_after" CHECK ("visit"."left_at" is null or "visit"."left_at" >= "visit"."arrived_at")
);
--> statement-breakpoint
ALTER TABLE "visit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business" ADD COLUMN "accepts_cleaning_requests" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "unit" ADD COLUMN "cleaning_status" "cleaning_status" DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "cleaning_request" ADD CONSTRAINT "cleaning_request_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_request" ADD CONSTRAINT "cleaning_request_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_request" ADD CONSTRAINT "cleaning_request_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_author_id_person_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task" ADD CONSTRAINT "recurring_task_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task" ADD CONSTRAINT "recurring_task_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task" ADD CONSTRAINT "recurring_task_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_log" ADD CONSTRAINT "task_log_task_id_recurring_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."recurring_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_log" ADD CONSTRAINT "task_log_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_log" ADD CONSTRAINT "task_log_done_by_person_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleaning_request_business_status_idx" ON "cleaning_request" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "cleaning_request_resident_id_idx" ON "cleaning_request" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "message_resident_created_idx" ON "message" USING btree ("resident_id","created_at");--> statement-breakpoint
CREATE INDEX "parcel_business_received_idx" ON "parcel" USING btree ("business_id","received_at");--> statement-breakpoint
CREATE INDEX "parcel_resident_id_idx" ON "parcel" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "recurring_task_business_due_idx" ON "recurring_task" USING btree ("business_id","next_due");--> statement-breakpoint
CREATE INDEX "review_business_created_idx" ON "review" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "supplier_business_id_idx" ON "supplier" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "task_log_task_done_idx" ON "task_log" USING btree ("task_id","done_on");--> statement-breakpoint
CREATE INDEX "visit_business_arrived_idx" ON "visit" USING btree ("business_id","arrived_at");--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- ¿El negocio deja que sus residentes pidan limpieza? El residente no puede leer la tabla business (RLS): la política
-- de cleaning_request pregunta con esta función, que solo responde sí o no.
CREATE FUNCTION public.business_accepts_cleaning(p_business_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT b.accepts_cleaning_requests FROM public.business b WHERE b.id = p_business_id), false);
$$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.business_accepts_cleaning(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.business_accepts_cleaning(uuid) TO authenticated;--> statement-breakpoint
CREATE POLICY "cleaning_request_landlord_all" ON "cleaning_request" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cleaning_request"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("cleaning_request"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "cleaning_request_select_own" ON "cleaning_request" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("cleaning_request"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "cleaning_request_insert_own" ON "cleaning_request" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("cleaning_request"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))
        and "cleaning_request"."business_id" = (select r.business_id from public.resident r where r.id = "cleaning_request"."resident_id")
        and public.business_accepts_cleaning("cleaning_request"."business_id")
        and "cleaning_request"."status" = 'requested' and "cleaning_request"."scheduled_for" is null and "cleaning_request"."done_at" is null
        and ("cleaning_request"."unit_id" is null or "cleaning_request"."unit_id" in (select c.unit_id from public.contract c where c.resident_id = "cleaning_request"."resident_id")));--> statement-breakpoint
CREATE POLICY "message_landlord_all" ON "message" AS PERMISSIVE FOR ALL TO "authenticated" USING ("message"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("message"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) and "message"."author_id" in (select id from public.person where user_id = (select auth.uid())) and "message"."from_resident" = false);--> statement-breakpoint
CREATE POLICY "message_select_own" ON "message" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("message"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "message_insert_own" ON "message" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("message"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))) and "message"."author_id" in (select id from public.person where user_id = (select auth.uid()))
        and "message"."from_resident" = true and "message"."read_at" is null);--> statement-breakpoint
CREATE POLICY "parcel_landlord_all" ON "parcel" AS PERMISSIVE FOR ALL TO "authenticated" USING ("parcel"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("parcel"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))
        and "parcel"."resident_id" in (select r.id from public.resident r where r.business_id = "parcel"."business_id"));--> statement-breakpoint
CREATE POLICY "parcel_select_own" ON "parcel" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("parcel"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "recurring_task_landlord_all" ON "recurring_task" AS PERMISSIVE FOR ALL TO "authenticated" USING ("recurring_task"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("recurring_task"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "review_select_own" ON "review" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("review"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "review_insert_own" ON "review" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("review"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))
        and "review"."business_id" = (select r.business_id from public.resident r where r.id = "review"."resident_id")
        and exists (select 1 from public.contract c where c.id = "review"."contract_id" and c.resident_id = "review"."resident_id"
          and c.status = 'confirmed' and c.end_date is not null
          and c.end_date <= (now() at time zone 'America/Lima')::date
          and not exists (select 1 from public.contract n where n.renewed_from_id = c.id and n.status <> 'cancelled')));--> statement-breakpoint
CREATE POLICY "supplier_landlord_all" ON "supplier" AS PERMISSIVE FOR ALL TO "authenticated" USING ("supplier"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("supplier"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "task_log_landlord_all" ON "task_log" AS PERMISSIVE FOR ALL TO "authenticated" USING ("task_log"."task_id" in (select t.id from public.recurring_task t where t.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("task_log"."task_id" in (select t.id from public.recurring_task t where t.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "visit_landlord_all" ON "visit" AS PERMISSIVE FOR ALL TO "authenticated" USING ("visit"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("visit"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
-- El residente marca como leídos los mensajes que le mandó su residencia (solo read_at, nunca el texto).
CREATE FUNCTION public.read_my_messages(p_resident_id uuid) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.message m SET read_at = now()
  WHERE m.resident_id = p_resident_id AND m.from_resident = false AND m.read_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.resident r JOIN public.person me ON me.id = r.person_id
      WHERE r.id = p_resident_id AND me.user_id = (SELECT auth.uid())
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.read_my_messages(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.read_my_messages(uuid) TO authenticated;--> statement-breakpoint
-- Reseñas de un negocio para su dueño (CR-05). Si la reseña es anónima, no devuelve ni el nombre ni la unidad.
CREATE FUNCTION public.business_reviews(p_business_id uuid)
RETURNS TABLE (
  id uuid, resident_name text, unit_name text, room smallint, cleaning smallint, treatment smallint,
  coexistence smallint, meal_plan smallint, comment text, recommends boolean, anonymous boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rv.id,
    CASE WHEN rv.anonymous THEN NULL ELSE p.full_name END,
    CASE WHEN rv.anonymous THEN NULL ELSE u.name END,
    rv.room, rv.cleaning, rv.treatment, rv.coexistence, rv.meal_plan, rv.comment, rv.recommends, rv.anonymous,
    rv.created_at
  FROM public.review rv
  JOIN public.business b ON b.id = rv.business_id
  JOIN public.person owner ON owner.id = b.owner_id
  JOIN public.resident r ON r.id = rv.resident_id
  JOIN public.person p ON p.id = r.person_id
  JOIN public.contract c ON c.id = rv.contract_id
  JOIN public.unit u ON u.id = c.unit_id
  WHERE rv.business_id = p_business_id AND owner.user_id = (SELECT auth.uid())
  ORDER BY rv.created_at DESC;
$$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.business_reviews(uuid) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.business_reviews(uuid) TO authenticated;
