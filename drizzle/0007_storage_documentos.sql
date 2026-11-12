-- Escrita a mano. BORRADOR: no aplicar sin la aprobación del dueño (CLAUDE.md, sección 2).
-- Espacio privado de Supabase Storage para los documentos de los residentes (DNI, contratos firmados…).
--
-- Cada archivo se guarda en: <negocio_id>/<ficha_residente_id>/<id_al_azar>.<extensión>
-- Las reglas de abajo leen esas dos carpetas para decidir quién puede verlo o subirlo:
--   - el arrendador: todo lo de sus negocios (ver, subir y borrar);
--   - el residente: solo lo de su propia ficha (ver y subir; borrar no).
-- Los archivos nunca son públicos: se ven con enlaces firmados que vencen a los pocos minutos.

-- El espacio ("bucket"): privado, máximo 20 MB por archivo, solo PDF e imágenes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
);
--> statement-breakpoint

-- ¿Es la primera carpeta un negocio de quien inició sesión? security definer por lo mismo que
-- is_resident_of_my_business (migración 0006): consulta las tablas sin pasar por su RLS.
CREATE FUNCTION public.storage_is_my_business(p_folder text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM public.business b
    JOIN public.person me ON me.id = b.owner_id
    WHERE b.id::text = p_folder AND me.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint

-- ¿Es la segunda carpeta la ficha de quien inició sesión, y la primera su negocio?
CREATE FUNCTION public.storage_is_my_resident_card(p_business text, p_resident text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM public.resident r
    JOIN public.person me ON me.id = r.person_id
    WHERE r.id::text = p_resident AND r.business_id::text = p_business AND me.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.storage_is_my_business(text) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.storage_is_my_resident_card(text, text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.storage_is_my_business(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.storage_is_my_resident_card(text, text) TO authenticated;
--> statement-breakpoint

-- Arrendador: ver, subir y borrar los archivos de sus negocios.
CREATE POLICY "documents_landlord_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.storage_is_my_business((storage.foldername(name))[1]));
--> statement-breakpoint
CREATE POLICY "documents_landlord_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.storage_is_my_business((storage.foldername(name))[1]));
--> statement-breakpoint
CREATE POLICY "documents_landlord_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.storage_is_my_business((storage.foldername(name))[1]));
--> statement-breakpoint

-- Residente: ver y subir solo en la carpeta de su ficha.
CREATE POLICY "documents_resident_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.storage_is_my_resident_card((storage.foldername(name))[1], (storage.foldername(name))[2])
);
--> statement-breakpoint
CREATE POLICY "documents_resident_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.storage_is_my_resident_card((storage.foldername(name))[1], (storage.foldername(name))[2])
);
