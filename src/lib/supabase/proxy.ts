import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";

// Rutas que piden sesión y rutas que no tienen sentido con sesión abierta.
const PRIVATE_PREFIXES = ["/panel", "/configurar", "/negocio", "/edificio"];
const GUEST_ONLY = ["/iniciar-sesion", "/registro"];

// Corre antes de cada página: renueva el token de sesión si venció y guarda las cookies nuevas.
// Las redirecciones de aquí son solo comodidad; la protección real está en src/server/auth/session.ts.
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cabeceras que impiden que una respuesta con la sesión de alguien se guarde en caché.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  const target =
    !signedIn && PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
      ? "/iniciar-sesion"
      : signedIn && GUEST_ONLY.includes(path)
        ? "/panel"
        : null;

  if (!target) return response;

  // La redirección también lleva las cookies renovadas, o la sesión se perdería.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
