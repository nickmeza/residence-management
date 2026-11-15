-- El plazo para que el residente reporte lo que ya estaba mal al ingresar se cuenta en DÍAS HÁBILES, de lunes a
-- viernes (decisión del dueño, 2026-11-15). Los feriados vendrán después. Igual que entryReportDeadline en
-- src/server/deposits/rules.ts. Solo cambia la cuenta del plazo; el resto de la función queda igual que en la 0010.

-- Último día del plazo: el N.º día hábil después del inicio (0 = el mismo día de inicio). Máximo 60 días hábiles
-- (el límite de deposit_settings), que caben de sobra en 100 días corridos.
CREATE FUNCTION public.entry_report_deadline(p_start date, p_days integer) RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_days <= 0 THEN p_start
    ELSE (
      SELECT d::date
      FROM generate_series(p_start + 1, p_start + 100, interval '1 day') AS d
      WHERE extract(isodow FROM d) < 6
      ORDER BY d
      OFFSET p_days - 1
      LIMIT 1
    )
  END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.entry_report_open(p_contract_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM public.contract c
    JOIN public.resident r ON r.id = c.resident_id
    LEFT JOIN public.deposit_settings s ON s.business_id = r.business_id
    WHERE c.id = p_contract_id
      AND c.status IN ('pending_signature', 'confirmed')
      AND (now() AT TIME ZONE 'America/Lima')::date
        <= public.entry_report_deadline(c.start_date, coalesce(s.entry_report_days, 7))
  );
$$;
