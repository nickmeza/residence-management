import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

// Cliente para componentes que corren en el navegador ("use client").
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
