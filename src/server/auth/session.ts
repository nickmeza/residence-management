import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { withRls, type SessionClaims } from "@/db/rls";
import { person } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

// Capa de acceso a datos: el único lugar que lee la sesión. Toda pantalla o acción privada
// pasa por aquí; el proxy solo redirige, no protege los datos.
export async function getSessionClaims(): Promise<SessionClaims> {
  // Supabase mira la hora (Date.now()) para saber si el token venció. connection() le dice a
  // Next.js que esto se calcula en cada visita y no al armar la página de antemano.
  await connection();
  const supabase = await createClient();
  // getClaims verifica la firma del token; no basta con leer la cookie.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    redirect("/iniciar-sesion");
  }
  return claims as SessionClaims;
}

export type CurrentPerson = { id: string; fullName: string };

export async function getCurrentPerson(): Promise<CurrentPerson> {
  const claims = await getSessionClaims();
  const [me] = await withRls(claims, (tx) =>
    tx
      .select({ id: person.id, fullName: person.fullName })
      .from(person)
      .where(eq(person.userId, claims.sub))
      .limit(1),
  );
  if (!me) {
    // No debería pasar: el trigger crea la persona al registrarse.
    throw new Error("La cuenta no tiene una persona asociada.");
  }
  return me;
}
