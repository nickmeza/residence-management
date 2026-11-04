import "server-only";

import { connection } from "next/server";

import { getSupabaseEnv } from "./env";

// Comprobación mínima de la Fase 0: pregunta al servicio de cuentas de Supabase si responde.
// No lee ni escribe datos: todavía no hay tablas.
export async function checkSupabaseConnection(): Promise<{ ok: boolean; detail: string }> {
  // Se consulta en cada visita, no una sola vez al compilar.
  await connection();
  try {
    const { url, publishableKey } = getSupabaseEnv();
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
    });
    return res.ok
      ? { ok: true, detail: "Conectado" }
      : { ok: false, detail: `Respondió con error ${res.status}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Sin conexión" };
  }
}
