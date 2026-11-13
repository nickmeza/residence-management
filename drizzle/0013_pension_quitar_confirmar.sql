-- Fase 6 · Pensión, ajuste 1 de 2. BORRADOR: no aplicar sin la aprobación del dueño (CLAUDE.md, sección 2).
-- El dueño decidió (2026-11-13) que por defecto SE COCINA para todos y el comensal CANCELA hasta el día anterior.
-- Se quitan la "confirmación" de la 0012 y su hora límite; la 0014 agrega "cancelación". No hay datos reales.
DROP FUNCTION public.confirm_my_meal(uuid, date, public.meal_type, boolean);--> statement-breakpoint
ALTER TABLE "meal_attendance" DROP COLUMN "confirmed";--> statement-breakpoint
ALTER TABLE "meal_settings" DROP COLUMN "confirm_deadline";
