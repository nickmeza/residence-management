"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { getShellData } from "@/server/business/current";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import { invitationExpiry, invitationMessage, newInvitationToken, whatsappLink } from "./invitation";
import * as m from "./mutations";
import { residentSchema } from "./schemas";

// Acciones de la pantalla Residentes. Validan en el servidor y corren con la sesión (RLS).

export type ResidentResult =
  { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const NOT_FOUND = "No encontramos a ese residente. Recarga la página.";

// Agrega un residente al negocio elegido arriba.
export async function createResidentAction(input: unknown): Promise<ResidentResult> {
  const parsed = residentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const { current } = await getShellData();
  if (!current) return { ok: false, message: "Primero configura tu negocio." };
  const claims = await getSessionClaims();
  try {
    const id = await withRls(claims, (tx) => m.createResident(tx, current.id, parsed.data));
    if (!id) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
    revalidatePath("/residentes");
    return { ok: true, id };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "No pudimos guardar al residente. Vuelve a intentarlo." };
  }
}

export async function updateResidentAction(id: string, input: unknown): Promise<ResidentResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = residentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const claims = await getSessionClaims();
  try {
    const found = await withRls(claims, (tx) => m.updateResident(tx, id, parsed.data));
    if (!found) return { ok: false, message: NOT_FOUND };
    revalidatePath("/residentes");
    revalidatePath(`/residentes/${id}`);
    return { ok: true, id };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "No pudimos guardar los cambios. Vuelve a intentarlo." };
  }
}

export type InvitationResult =
  { ok: true; message: string; whatsappUrl: string; expiresAt: string } | { ok: false; message: string };

// Crea un enlace de invitación nuevo; los anteriores sin usar dejan de servir.
// El enlace se devuelve una sola vez: en la base queda solo su hash.
export async function inviteResidentAction(id: string): Promise<InvitationResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const claims = await getSessionClaims();
  const origin = (await headers()).get("origin") ?? "";
  const token = newInvitationToken();
  const expiresAt = invitationExpiry(new Date());
  try {
    const found = await withRls(claims, (tx) =>
      m.createInvitation(tx, { residentId: id, token, expiresAt, userId: claims.sub }),
    );
    if (found.status === "not_found") return { ok: false, message: NOT_FOUND };
    if (found.status === "has_account") {
      return { ok: false, message: "Ya tiene cuenta en la app: no necesita invitación." };
    }
    revalidatePath(`/residentes/${id}`);
    const message = invitationMessage({
      residentName: found.fullName,
      businessName: found.businessName,
      url: `${origin}/invitacion/${token}`,
    });
    return {
      ok: true,
      message,
      whatsappUrl: whatsappLink(found.phone, message),
      expiresAt: expiresAt.toISOString(),
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "No pudimos crear la invitación. Vuelve a intentarlo." };
  }
}
