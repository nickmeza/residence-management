"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import { ApplicationReviewError, reviewApplication, setAcceptsApplications } from "./mutations";
import { ApplicationError, submitApplication } from "./public";
import { applicationReviewSchema, applicationSchema } from "./schemas";

export type ApplicationResult =
  | { ok: true; residentId?: string; tradeName?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

// Formulario público (sin sesión): valida todo y lo guarda el servidor.
export async function submitApplicationAction(
  businessId: string,
  input: unknown,
): Promise<ApplicationResult> {
  if (!isUuid(businessId)) return { ok: false, message: "Este enlace no existe." };
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  try {
    const tradeName = await submitApplication(businessId, parsed.data);
    return { ok: true, tradeName };
  } catch (e) {
    if (e instanceof ApplicationError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos enviar tu postulación. Vuelve a intentarlo." };
  }
}

async function run<T>(change: Parameters<typeof withRls<T>>[1]) {
  const claims = await getSessionClaims();
  try {
    const value = await withRls(claims, change);
    revalidatePath("/postulantes", "layout");
    revalidatePath("/residentes", "layout");
    return { ok: true as const, value };
  } catch (e) {
    if (e instanceof ApplicationReviewError) return { ok: false as const, message: e.message };
    console.error(e);
    return { ok: false as const, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

export async function setAcceptsApplicationsAction(
  businessId: string,
  on: boolean,
): Promise<ApplicationResult> {
  if (!isUuid(businessId)) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
  const r = await run((tx) => setAcceptsApplications(tx, businessId, on === true));
  return r.ok ? { ok: true } : r;
}

export async function reviewApplicationAction(id: string, input: unknown): Promise<ApplicationResult> {
  if (!isUuid(id)) return { ok: false, message: "No encontramos esa postulación. Recarga la página." };
  const parsed = applicationReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los campos marcados." };
  const r = await run((tx) => reviewApplication(tx, id, parsed.data));
  return r.ok ? { ok: true, residentId: r.value ?? undefined } : r;
}
