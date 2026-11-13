-- Fase 6 · Pensión, ajuste 2 de 2. BORRADOR: no aplicar sin la aprobación del dueño (CLAUDE.md, sección 2).
-- Parte 1 (generada por drizzle-kit): hora de cancelación, "canceló" en la asistencia, frecuencia de cobro y pagos.
-- Parte 2 (escrita a mano, al final): función cancel_my_meal y bitácora de los pagos.
CREATE TYPE "public"."pension_billing_cycle" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "pension_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"covers_from" date NOT NULL,
	"covers_to" date NOT NULL,
	"note" text,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pension_payment_amount_positive" CHECK ("pension_payment"."amount" > 0),
	CONSTRAINT "pension_payment_dates" CHECK ("pension_payment"."covers_to" >= "pension_payment"."covers_from")
);
--> statement-breakpoint
ALTER TABLE "pension_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal_attendance" ADD COLUMN "cancelled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_settings" ADD COLUMN "cancel_deadline" time DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "pension_subscription" ADD COLUMN "billing_cycle" "pension_billing_cycle" DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD CONSTRAINT "pension_payment_subscription_id_pension_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."pension_subscription"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD CONSTRAINT "pension_payment_registered_by_person_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pension_payment_subscription_id_idx" ON "pension_payment" USING btree ("subscription_id");--> statement-breakpoint
CREATE POLICY "pension_payment_landlord_all" ON "pension_payment" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pension_payment"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))) WITH CHECK ("pension_payment"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "pension_payment_select_own" ON "pension_payment" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pension_payment"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint

-- Escrito a mano. El comensal cancela (o vuelve a pedir) una comida. Devuelve 'ok' o el motivo:
-- 'not_found' (no es su ficha), 'no_plan' (su plan no cubre ese día o esa comida), 'paused' (día pausado),
-- 'closed' (pasó la hora límite: la hora de cancelación del DÍA ANTERIOR, en hora de Lima; después solo la cocina).
-- Cancelar a tiempo no se cobra (queda como saldo a favor); eso lo calcula el servidor con estas filas.
CREATE FUNCTION public.cancel_my_meal(p_resident_id uuid, p_date date, p_meal public.meal_type, p_cancel boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid;
  v_business uuid;
  v_sub uuid;
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
  IF v_sub IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.meal m WHERE m.business_id = v_business AND m.type = p_meal AND m.active
  ) THEN
    RETURN 'no_plan';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pension_pause x WHERE x.subscription_id = v_sub AND p_date BETWEEN x.from_date AND x.to_date
  ) THEN
    RETURN 'paused';
  END IF;

  SELECT coalesce((SELECT st.cancel_deadline FROM public.meal_settings st WHERE st.business_id = v_business), '20:00')
  INTO v_deadline;
  IF (now() AT TIME ZONE 'America/Lima') >= (p_date - 1) + v_deadline THEN
    RETURN 'closed';
  END IF;

  IF p_cancel THEN
    INSERT INTO public.meal_attendance (resident_id, date, meal, cancelled, updated_by)
    VALUES (p_resident_id, p_date, p_meal, true, v_me)
    ON CONFLICT (resident_id, date, meal)
    DO UPDATE SET cancelled = true, updated_by = EXCLUDED.updated_by, updated_at = now();
  ELSE
    -- Volver a pedirla: sin fila = viene.
    DELETE FROM public.meal_attendance a
    WHERE a.resident_id = p_resident_id AND a.date = p_date AND a.meal = p_meal AND NOT a.served;
  END IF;
  RETURN 'ok';
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.cancel_my_meal(uuid, date, public.meal_type, boolean) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cancel_my_meal(uuid, date, public.meal_type, boolean) TO authenticated;
--> statement-breakpoint

-- Bitácora de dinero (CLAUDE.md, sección 10): los pagos de la pensión también quedan anotados.
CREATE TRIGGER pension_payment_money_log AFTER INSERT OR UPDATE OR DELETE ON public.pension_payment
FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
