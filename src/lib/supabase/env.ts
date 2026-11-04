// Lee las variables de Supabase de .env.local y avisa con claridad si falta alguna.
// Ambas son públicas (NEXT_PUBLIC_): se pueden usar en el navegador. La protección de los datos
// la dan las políticas RLS de la base, no esconder estas claves.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Faltan variables de Supabase en .env.local: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  // Error común: copiar la dirección de la API REST (".../rest/v1/"). La librería agrega las rutas sola.
  if (new URL(url).pathname !== "/") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL debe ser solo la base del proyecto (https://<referencia>.supabase.co), sin /rest/v1/ ni otra ruta.",
    );
  }

  return { url, publishableKey };
}
