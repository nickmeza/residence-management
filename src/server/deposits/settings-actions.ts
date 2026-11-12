"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";
import { depositSettingsSchema, unitExceptionSchema } from "@/server/payments/schemas";

import * as m from "./settings";

// Acciones de Configuración › Garantía. Los cambios valen para los contratos que se confirmen desde ahora: la
// garantía de un contrato se calcula una sola vez, al confirmarlo.

export type SettingsResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

async function run(businessId: string, change: Parameters<typeof withRls<void>>[1]): Promise<SettingsResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, change);
    revalidatePath(`/negocio/${businessId}/garantia`);
    revalidatePath("/contratos", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof m.SettingsError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

const NOT_FOUND = "No encontramos tu negocio. Recarga la página.";

export async function saveDepositSettingsAction(businessId: string, input: unknown): Promise<SettingsResult> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = depositSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  return run(businessId, (tx) => m.saveDepositSettings(tx, businessId, parsed.data));
}

export async function saveUnitExceptionAction(businessId: string, input: unknown): Promise<SettingsResult> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = unitExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  return run(businessId, (tx) => m.saveUnitException(tx, parsed.data));
}

export async function deleteUnitExceptionAction(businessId: string, unitId: string): Promise<SettingsResult> {
  if (!isUuid(businessId) || !isUuid(unitId)) return { ok: false, message: NOT_FOUND };
  return run(businessId, (tx) => m.deleteUnitException(tx, unitId));
}
