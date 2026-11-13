"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import * as m from "./mutations";
import { pensionSettingsSchema, planSchema } from "./schemas";

// Acciones de la pensión. Cada una: valida con Zod, corre con la sesión (RLS) y vuelve a dibujar las pantallas.

export type PensionResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const NOT_FOUND = "No encontramos tu pensión. Recarga la página.";

async function run(change: Parameters<typeof withRls<void>>[1]): Promise<PensionResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, change);
    revalidatePath("/pension", "layout");
    revalidatePath("/mi", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof m.PensionError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

const invalid = (error: Parameters<typeof issuesByPath>[0]): PensionResult => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: issuesByPath(error),
});

export async function savePensionSettingsAction(businessId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = pensionSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.savePensionSettings(tx, businessId, parsed.data));
}

export async function savePlanAction(
  businessId: string,
  planId: string | null,
  input: unknown,
): Promise<PensionResult> {
  if (!isUuid(businessId) || (planId !== null && !isUuid(planId))) return { ok: false, message: NOT_FOUND };
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.savePlan(tx, businessId, planId, parsed.data));
}

export async function deletePlanAction(businessId: string, planId: string): Promise<PensionResult> {
  if (!isUuid(businessId) || !isUuid(planId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.deletePlan(tx, businessId, planId));
}
