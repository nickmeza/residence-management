"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { withRls } from "@/db/rls";
import { business } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { businessSchema, issuesByPath } from "@/server/onboarding/schema";

import { CURRENT_BUSINESS_COOKIE } from "./current";
import { isUuid } from "./queries";

// Cambia el negocio que se está viendo (selector de arriba). Solo acepta negocios propios.
export async function selectBusiness(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const claims = await getSessionClaims();
  const [found] = await withRls(claims, (tx) =>
    tx.select({ id: business.id }).from(business).where(eq(business.id, id)).limit(1),
  );
  if (!found) return { ok: false };
  (await cookies()).set(CURRENT_BUSINESS_COOKIE, found.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}

export type UpdateBusinessResult =
  { status: "saved" } | { status: "error"; message: string; fieldErrors?: Record<string, string> };

// Guarda los datos de un negocio (pantalla Configuración › Negocio). Valida en el servidor y corre con
// la sesión: si el negocio no es de quien envía, el RLS hace que no se actualice nada.
export async function updateBusiness(id: string, input: unknown): Promise<UpdateBusinessResult> {
  if (!isUuid(id)) return { status: "error", message: "No encontramos ese negocio." };
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      fieldErrors: issuesByPath(parsed.error),
    };
  }
  const claims = await getSessionClaims();
  try {
    const updated = await withRls(claims, (tx) =>
      tx.update(business).set(parsed.data).where(eq(business.id, id)).returning({ id: business.id }),
    );
    if (!updated.length) return { status: "error", message: "No encontramos ese negocio." };
  } catch (e) {
    console.error(e);
    return { status: "error", message: "No pudimos guardar los cambios. Vuelve a intentarlo." };
  }
  return { status: "saved" };
}
