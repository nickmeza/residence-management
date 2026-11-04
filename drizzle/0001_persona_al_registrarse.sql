-- Al crear una cuenta en Supabase Auth, se crea su Persona con el nombre del formulario y el correo.
-- security definer: corre con permisos del dueño de la función, porque el usuario recién registrado
-- todavía no puede escribir en public.person (no hay política de insert para él).
-- search_path vacío: obliga a escribir public.person completo y evita que alguien la engañe con otra tabla.
CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.person (user_id, full_name, email)
  VALUES (
    NEW.id,
    coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- Las funciones en public se pueden llamar desde la API de Supabase: esta solo debe usarla el trigger.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
