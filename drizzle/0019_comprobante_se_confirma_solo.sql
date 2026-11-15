ALTER TABLE "payment" ADD COLUMN "auto_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Parte 2 (escrita a mano): el comprobante del residente se confirma solo si coincide EXACTAMENTE con lo que falta
-- del recibo (decisión del dueño, 2026-11-15). Lo revisa la base, con los datos reales, para que nadie pueda
-- forzarlo desde el navegador. Lo que falta = cargos del residente en ese mes − pagos confirmados de ese mes (igual
-- que receiptSummary en src/server/payments/rules.ts). Si no coincide, queda en revisión como siempre.
-- Devuelve true si lo confirmó.
CREATE FUNCTION public.auto_confirm_my_payment(p_payment_id uuid) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resident uuid;
  v_period text;
  v_amount numeric;
  v_charges numeric;
  v_paid numeric;
BEGIN
  -- Solo un pago en revisión, mandado por quien llama y de su propia ficha.
  SELECT p.resident_id, p.period, p.amount INTO v_resident, v_period, v_amount
  FROM public.payment p
  JOIN public.resident r ON r.id = p.resident_id
  JOIN public.person me ON me.id = r.person_id
  WHERE p.id = p_payment_id AND p.status = 'in_review' AND p.submitted_by = me.id
    AND me.user_id = (SELECT auth.uid());
  IF v_resident IS NULL THEN
    RETURN false;
  END IF;

  SELECT coalesce(sum(c.amount), 0) INTO v_charges
  FROM public.charge c JOIN public.contract k ON k.id = c.contract_id
  WHERE k.resident_id = v_resident AND c.period = v_period;

  SELECT coalesce(sum(x.amount), 0) INTO v_paid
  FROM public.payment x
  WHERE x.resident_id = v_resident AND x.period = v_period AND x.status = 'confirmed';

  IF v_charges - v_paid <= 0 OR v_amount <> v_charges - v_paid THEN
    RETURN false;
  END IF;

  UPDATE public.payment
  SET status = 'confirmed', auto_confirmed = true, reviewed_at = now()
  WHERE id = p_payment_id;
  RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.auto_confirm_my_payment(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.auto_confirm_my_payment(uuid) TO authenticated;
