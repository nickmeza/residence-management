import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

// Cliente para el servidor (Server Components, Server Actions, Route Handlers).
// Se crea uno por petición porque lee las cookies de sesión de ese usuario.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. Es normal: la sesión
          // la renueva src/proxy.ts antes de cada página.
        }
      },
    },
  });
}
