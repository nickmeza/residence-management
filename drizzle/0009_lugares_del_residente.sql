-- Parte 1, escrita a mano. Lo que el residente necesita ver de su residencia sin darle permiso de leer las tablas del
-- arrendador (business, unit, property): solo los nombres de su residencia, su propiedad y su unidad, y si la unidad es
-- cuarto o departamento (para saber qué lista de documentos le toca).
-- No se agrega un permiso de lectura en business: varias pantallas del arrendador asumen que "si veo el negocio, es
-- mío" (por ejemplo, el selector de negocio), y un residente vería ahí la residencia donde vive.
-- security definer: consulta las tablas sin pasar por su RLS, pero solo devuelve filas de quien inició sesión.
CREATE FUNCTION public.my_resident_places()
RETURNS TABLE (
  resident_id uuid,
  business_id uuid,
  business_name text,
  contract_id uuid,
  unit_name text,
  unit_type public.unit_type,
  property_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, b.id, b.trade_name, c.id, u.name, u.type, p.name
  FROM public.resident r
  JOIN public.person me ON me.id = r.person_id AND me.user_id = (SELECT auth.uid())
  JOIN public.business b ON b.id = r.business_id
  LEFT JOIN public.contract c ON c.resident_id = r.id
  LEFT JOIN public.unit u ON u.id = c.unit_id
  LEFT JOIN public.floor f ON f.id = u.floor_id
  LEFT JOIN public.property p ON p.id = f.property_id;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.my_resident_places() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.my_resident_places() TO authenticated;

--> statement-breakpoint
-- Parte 2: las notas del arrendador pasan a su propia tabla (resident_note), que el residente no puede leer.
-- Antes estaban en resident.notes, y el residente puede leer su ficha (también por la API de Supabase).
CREATE TABLE "resident_note" (
	"resident_id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_note" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resident_note" ADD CONSTRAINT "resident_note_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Copia las notas que ya existen antes de quitar la columna: no se pierde ninguna.
INSERT INTO "resident_note" ("resident_id", "body")
SELECT "id", "notes" FROM "resident" WHERE coalesce(trim("notes"), '') <> '';--> statement-breakpoint
ALTER TABLE "resident" DROP COLUMN "notes";--> statement-breakpoint
CREATE POLICY "resident_note_landlord_all" ON "resident_note" AS PERMISSIVE FOR ALL TO "authenticated" USING ("resident_note"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("resident_note"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));