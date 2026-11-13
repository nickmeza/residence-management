ALTER TABLE "menu_item" DROP CONSTRAINT "menu_item_dish";--> statement-breakpoint
ALTER TABLE "meal_settings" ADD COLUMN "service_days" smallint[] DEFAULT '{1,2,3,4,5,6,7}' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_settings" ADD CONSTRAINT "meal_settings_service_days" CHECK (cardinality("meal_settings"."service_days") between 1 and 7 and "meal_settings"."service_days" <@ '{1,2,3,4,5,6,7}'::smallint[]);--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_dish" CHECK (length(trim("menu_item"."dish")) between 1 and 600);--> statement-breakpoint

-- Parte 2 (escrita a mano): cancel_my_meal rechaza los días en que la pensión no cocina ('no_service').
-- Sin fila de ajustes = cocina todos los días. El resto queda igual que en la 0014.
CREATE OR REPLACE FUNCTION public.cancel_my_meal(p_resident_id uuid, p_date date, p_meal public.meal_type, p_cancel boolean)
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
  v_days smallint[];
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

  SELECT st.cancel_deadline, st.service_days INTO v_deadline, v_days
  FROM public.meal_settings st WHERE st.business_id = v_business;
  IF v_days IS NOT NULL AND NOT (extract(isodow FROM p_date)::smallint = ANY (v_days)) THEN
    RETURN 'no_service';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pension_pause x WHERE x.subscription_id = v_sub AND p_date BETWEEN x.from_date AND x.to_date
  ) THEN
    RETURN 'paused';
  END IF;

  IF (now() AT TIME ZONE 'America/Lima') >= (p_date - 1) + coalesce(v_deadline, '20:00') THEN
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
