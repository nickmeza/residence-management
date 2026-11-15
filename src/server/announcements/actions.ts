"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import { AnnouncementError, sendAnnouncement } from "./mutations";
import { announcementSchema } from "./schemas";

export type AnnouncementResult =
  { ok: true; recipients: number } | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Enviar un comunicado: valida, guarda con la sesión (RLS) y avisa a cada destinatario.
export async function sendAnnouncementAction(
  businessId: string,
  input: unknown,
): Promise<AnnouncementResult> {
  if (!isUuid(businessId)) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const claims = await getSessionClaims();
  try {
    const recipients = await withRls(claims, (tx) =>
      sendAnnouncement(tx, businessId, parsed.data, claims.sub),
    );
    revalidatePath("/comunicados");
    revalidatePath("/mi", "layout");
    return { ok: true, recipients };
  } catch (e) {
    if (e instanceof AnnouncementError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos enviar el comunicado. Vuelve a intentarlo." };
  }
}
