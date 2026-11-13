-- Fase 6 · Pensión. BORRADOR: no aplicar sin la aprobación del dueño (CLAUDE.md, sección 2).
-- Parte 1 (generada por drizzle-kit desde src/db/schema.ts): tablas, índices y políticas de RLS.
-- Parte 2 (escrita a mano, al final): funciones del comensal y una regla de integridad.
CREATE TYPE "public"."meal_service_mode" AS ENUM('dine_in', 'takeaway', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner');--> statement-breakpoint
CREATE TYPE "public"."menu_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"type" "meal_type" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"single_price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "meal_times" CHECK ("meal"."end_time" > "meal"."start_time"),
	CONSTRAINT "meal_price_not_negative" CHECK ("meal"."single_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "meal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meal_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal" "meal_type" NOT NULL,
	"confirmed" boolean NOT NULL,
	"served" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meal_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"confirm_deadline" time DEFAULT '10:00' NOT NULL,
	"service_modes" "meal_service_mode"[] DEFAULT '{dine_in}' NOT NULL,
	"seats_per_turn" smallint,
	"accepts_external" boolean DEFAULT true NOT NULL,
	"diets" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_settings_seats" CHECK ("meal_settings"."seats_per_turn" is null or "meal_settings"."seats_per_turn" between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "meal_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "menu_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal" "meal_type" NOT NULL,
	"dish" text NOT NULL,
	"has_vegetarian" boolean DEFAULT false NOT NULL,
	"status" "menu_status" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "menu_item_dish" CHECK (length(trim("menu_item"."dish")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "menu_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pension_pause" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pension_pause_dates" CHECK ("pension_pause"."to_date" >= "pension_pause"."from_date")
);
--> statement-breakpoint
ALTER TABLE "pension_pause" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pension_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"meals" "meal_type"[] NOT NULL,
	"daily_price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pension_plan_meals" CHECK (cardinality("pension_plan"."meals") between 1 and 3),
	CONSTRAINT "pension_plan_price" CHECK ("pension_plan"."daily_price" >= 0),
	CONSTRAINT "pension_plan_name" CHECK (length(trim("pension_plan"."name")) between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "pension_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pension_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"diet_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pension_subscription_dates" CHECK ("pension_subscription"."end_date" is null or "pension_subscription"."end_date" >= "pension_subscription"."start_date")
);
--> statement-breakpoint
ALTER TABLE "pension_subscription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_attendance" ADD CONSTRAINT "meal_attendance_updated_by_person_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_settings" ADD CONSTRAINT "meal_settings_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_pause" ADD CONSTRAINT "pension_pause_subscription_id_pension_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."pension_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_plan" ADD CONSTRAINT "pension_plan_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_subscription" ADD CONSTRAINT "pension_subscription_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_subscription" ADD CONSTRAINT "pension_subscription_plan_id_pension_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pension_plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meal_business_type_idx" ON "meal" USING btree ("business_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_attendance_resident_date_meal_idx" ON "meal_attendance" USING btree ("resident_id","date","meal");--> statement-breakpoint
CREATE INDEX "meal_attendance_date_idx" ON "meal_attendance" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_item_business_date_meal_idx" ON "menu_item" USING btree ("business_id","date","meal");--> statement-breakpoint
CREATE INDEX "pension_pause_subscription_id_idx" ON "pension_pause" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "pension_plan_business_id_idx" ON "pension_plan" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "pension_subscription_resident_id_idx" ON "pension_subscription" USING btree ("resident_id");--> statement-breakpoint
CREATE POLICY "meal_landlord_all" ON "meal" AS PERMISSIVE FOR ALL TO "authenticated" USING ("meal"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("meal"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "meal_select_as_diner" ON "meal" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("meal"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "meal_attendance_landlord_all" ON "meal_attendance" AS PERMISSIVE FOR ALL TO "authenticated" USING ("meal_attendance"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("meal_attendance"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "meal_attendance_select_own" ON "meal_attendance" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("meal_attendance"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "meal_settings_landlord_all" ON "meal_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("meal_settings"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("meal_settings"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "meal_settings_select_as_diner" ON "meal_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("meal_settings"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "menu_item_landlord_all" ON "menu_item" AS PERMISSIVE FOR ALL TO "authenticated" USING ("menu_item"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("menu_item"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "menu_item_select_published" ON "menu_item" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("menu_item"."status" = 'published' and "menu_item"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "pension_pause_landlord_all" ON "pension_pause" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pension_pause"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))) WITH CHECK ("pension_pause"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "pension_pause_select_own" ON "pension_pause" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pension_pause"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "pension_plan_landlord_all" ON "pension_plan" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pension_plan"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("pension_plan"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "pension_plan_select_as_diner" ON "pension_plan" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pension_plan"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "pension_subscription_landlord_all" ON "pension_subscription" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pension_subscription"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("pension_subscription"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "pension_subscription_select_own" ON "pension_subscription" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pension_subscription"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint

-- Escrito a mano. Lo que el comensal puede hacer con su sesión pasa por estas funciones (como en la Fase 5): así no
-- puede saltarse la hora límite ni pausar días ya servidos, ni siquiera por la API. El arrendador (cocina) cambia las
-- tablas directamente con su RLS. Hora de Lima en todo (CLAUDE.md, sección 10).

-- Una afiliación solo puede usar un plan del mismo negocio que la ficha del comensal.
CREATE FUNCTION public.pension_subscription_same_business() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.resident r JOIN public.pension_plan p ON p.business_id = r.business_id
    WHERE r.id = NEW.resident_id AND p.id = NEW.plan_id
  ) THEN
    RAISE EXCEPTION 'El plan no es del negocio del comensal';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pension_subscription_same_business
BEFORE INSERT OR UPDATE OF resident_id, plan_id ON public.pension_subscription
FOR EACH ROW EXECUTE FUNCTION public.pension_subscription_same_business();
--> statement-breakpoint

-- El comensal confirma (o avisa que no viene a) una comida. Devuelve 'ok' o el motivo:
-- 'not_found' (no es su ficha), 'no_plan' (su plan no cubre ese día o esa comida), 'paused' (día pausado),
-- 'closed' (pasó la hora límite: después solo la cocina puede cambiarla).
-- Hora límite de la comida = la hora límite del negocio ese día, o el inicio de la comida si es antes.
CREATE FUNCTION public.confirm_my_meal(p_resident_id uuid, p_date date, p_meal public.meal_type, p_going boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid;
  v_business uuid;
  v_sub uuid;
  v_start time;
  v_deadline time;
BEGIN
  SELECT me.id, r.business_id INTO v_me, v_business
  FROM public.resident r JOIN public.person me ON me.id = r.person_id
  WHERE r.id = p_resident_id AND me.user_id = (SELECT auth.uid());
  IF v_me IS NULL THEN
    RETURN 'not_found';
  END IF;

  SELECT s.id INTO v_sub
  FROM public.pension_subscription s JOIN public.pension_plan p ON p.id = s.plan_id
  WHERE s.resident_id = p_resident_id AND s.start_date <= p_date
    AND (s.end_date IS NULL OR s.end_date >= p_date) AND p_meal = ANY (p.meals)
  LIMIT 1;
  IF v_sub IS NULL THEN
    RETURN 'no_plan';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pension_pause x WHERE x.subscription_id = v_sub AND p_date BETWEEN x.from_date AND x.to_date
  ) THEN
    RETURN 'paused';
  END IF;

  SELECT m.start_time INTO v_start FROM public.meal m
  WHERE m.business_id = v_business AND m.type = p_meal AND m.active;
  IF v_start IS NULL THEN
    RETURN 'no_plan';
  END IF;
  SELECT coalesce((SELECT st.confirm_deadline FROM public.meal_settings st WHERE st.business_id = v_business), '10:00')
  INTO v_deadline;
  IF (now() AT TIME ZONE 'America/Lima') >= p_date + least(v_deadline, v_start) THEN
    RETURN 'closed';
  END IF;

  INSERT INTO public.meal_attendance (resident_id, date, meal, confirmed, updated_by)
  VALUES (p_resident_id, p_date, p_meal, p_going, v_me)
  ON CONFLICT (resident_id, date, meal)
  DO UPDATE SET confirmed = EXCLUDED.confirmed, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN 'ok';
END;
$$;
--> statement-breakpoint

-- El comensal pausa su pensión por unos días (PN-15). Devuelve 'ok' o el motivo: 'not_found', 'invalid' (fechas al
-- revés, en el pasado o fuera de su afiliación), 'served' (ya comió algún día de ese rango), 'overlap' (ya tiene una
-- pausa en esas fechas). Los días pausados no se cobran ni se cocinan: se borran sus confirmaciones.
CREATE FUNCTION public.pause_my_pension(p_subscription_id uuid, p_from date, p_to date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resident uuid;
  v_start date;
  v_end date;
  v_today date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  SELECT s.resident_id, s.start_date, s.end_date INTO v_resident, v_start, v_end
  FROM public.pension_subscription s
  JOIN public.resident r ON r.id = s.resident_id
  JOIN public.person me ON me.id = r.person_id
  WHERE s.id = p_subscription_id AND me.user_id = (SELECT auth.uid());
  IF v_resident IS NULL THEN
    RETURN 'not_found';
  END IF;
  IF p_to < p_from OR p_from < v_today OR p_from < v_start OR (v_end IS NOT NULL AND p_to > v_end) THEN
    RETURN 'invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.meal_attendance a
    WHERE a.resident_id = v_resident AND a.served AND a.date BETWEEN p_from AND p_to
  ) THEN
    RETURN 'served';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pension_pause x
    WHERE x.subscription_id = p_subscription_id AND x.from_date <= p_to AND x.to_date >= p_from
  ) THEN
    RETURN 'overlap';
  END IF;
  INSERT INTO public.pension_pause (subscription_id, from_date, to_date) VALUES (p_subscription_id, p_from, p_to);
  DELETE FROM public.meal_attendance a
  WHERE a.resident_id = v_resident AND a.date BETWEEN p_from AND p_to AND NOT a.served;
  RETURN 'ok';
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.confirm_my_meal(uuid, date, public.meal_type, boolean) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.pause_my_pension(uuid, date, date) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.confirm_my_meal(uuid, date, public.meal_type, boolean) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.pause_my_pension(uuid, date, date) TO authenticated;
