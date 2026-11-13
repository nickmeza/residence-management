-- Foto de portada de cada edificio. La sube el arrendador; el residente la ve en su inicio.
-- Parte 1 (generada por drizzle-kit): la columna. Vacía = sin foto (el inicio usa la foto de respaldo o una franja).
ALTER TABLE "property" ADD COLUMN "cover_photo_path" text;
--> statement-breakpoint

-- Parte 2, escrita a mano: el residente recibe la ruta de la foto de su edificio junto con los demás datos de su
-- residencia. Se borra y se vuelve a crear porque cambia lo que devuelve (Postgres no deja agregar columnas con
-- CREATE OR REPLACE). Igual que en 0009: security definer, solo filas de quien inició sesión.
DROP FUNCTION public.my_resident_places();
--> statement-breakpoint
CREATE FUNCTION public.my_resident_places()
RETURNS TABLE (
  resident_id uuid,
  business_id uuid,
  business_name text,
  contract_id uuid,
  unit_name text,
  unit_type public.unit_type,
  property_name text,
  property_cover_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, b.id, b.trade_name, c.id, u.name, u.type, p.name, p.cover_photo_path
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

-- Parte 3, escrita a mano: permiso para VER (no subir ni borrar) las fotos de portada.
-- Las fotos van en <negocio>/portadas/<id>.<ext> del espacio privado "documents" (migración 0007).
-- El arrendador ya puede ver, subir y borrar todo lo de su negocio (documents_landlord_*).
-- El residente solo puede ver las portadas de los negocios donde tiene ficha; los demás archivos siguen igual.

-- ¿Quien inició sesión tiene ficha de residente en este negocio?
CREATE FUNCTION public.storage_is_resident_of(p_business text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM public.resident r
    JOIN public.person me ON me.id = r.person_id
    WHERE r.business_id::text = p_business AND me.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.storage_is_resident_of(text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.storage_is_resident_of(text) TO authenticated;
--> statement-breakpoint
CREATE POLICY "documents_resident_cover_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[2] = 'portadas'
  AND public.storage_is_resident_of((storage.foldername(name))[1])
);
