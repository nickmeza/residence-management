"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";
import { fileExists } from "@/server/payments/storage";

import * as m from "./mutations";
import {
  attendanceSchema,
  dinerContactSchema,
  kitchenChangeSchema,
  newDinerSchema,
  pauseSchema,
  pensionPaymentSchema,
  pensionProofSchema,
  pensionReviewSchema,
  pensionSettingsSchema,
  planSchema,
  subscriptionEditSchema,
  subscriptionSchema,
  weekMenuSchema,
} from "./schemas";

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
    revalidatePath("/negocio", "layout");
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

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

// Agregar comensal: devuelve su id para abrir su página.
export async function addDinerAction(
  businessId: string,
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> }> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = newDinerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as { ok: false; message: string };
  let id = "";
  const result = await run(async (tx) => {
    id = await m.addDiner(tx, businessId, parsed.data);
  });
  return result.ok ? { ok: true, id } : result;
}

export async function updateDinerContactAction(
  businessId: string,
  residentId: string,
  input: unknown,
): Promise<PensionResult> {
  if (!isUuid(businessId) || !isUuid(residentId)) return { ok: false, message: NOT_FOUND };
  const parsed = dinerContactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.updateDinerContact(tx, businessId, residentId, parsed.data));
}

export async function subscribeAction(businessId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.subscribe(tx, businessId, parsed.data));
}

export async function updateSubscriptionAction(
  subscriptionId: string,
  input: unknown,
): Promise<PensionResult> {
  if (!isUuid(subscriptionId)) return { ok: false, message: NOT_FOUND };
  const parsed = subscriptionEditSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.updateSubscription(tx, subscriptionId, parsed.data));
}

export async function addPauseAction(subscriptionId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(subscriptionId)) return { ok: false, message: NOT_FOUND };
  const parsed = pauseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.addPause(tx, subscriptionId, parsed.data.fromDate, parsed.data.toDate));
}

export async function removePauseAction(pauseId: string): Promise<PensionResult> {
  if (!isUuid(pauseId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.removePause(tx, pauseId));
}

export async function kitchenChangeAction(businessId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = kitchenChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos guardar el cambio. Recarga la página." };
  return run((tx) => m.kitchenChange(tx, businessId, parsed.data));
}

export async function saveWeekMenuAction(businessId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(businessId)) return { ok: false, message: NOT_FOUND };
  const parsed = weekMenuSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.saveWeekMenu(tx, businessId, parsed.data.entries, parsed.data.publish));
}

export async function copyPreviousWeekAction(businessId: string, monday: string): Promise<PensionResult> {
  if (!isUuid(businessId) || !isDate(monday)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.copyPreviousWeek(tx, businessId, monday));
}

export async function registerPensionPaymentAction(input: unknown): Promise<PensionResult> {
  const parsed = pensionPaymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.registerPensionPayment(tx, parsed.data));
}

export async function deletePensionPaymentAction(paymentId: string): Promise<PensionResult> {
  if (!isUuid(paymentId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.deletePensionPayment(tx, paymentId));
}

// El comensal avisa su pago con comprobante (queda en revisión).
export async function submitPensionProofAction(input: unknown): Promise<PensionResult> {
  const parsed = pensionProofSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await fileExists(parsed.data.proofPath))) {
    return { ok: false, message: "No encontramos el comprobante subido. Vuelve a subirlo." };
  }
  return run((tx) => m.submitPensionProof(tx, parsed.data));
}

// La cocina aprueba o rechaza un comprobante.
export async function reviewPensionPaymentAction(paymentId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(paymentId)) return { ok: false, message: NOT_FOUND };
  const parsed = pensionReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el motivo." };
  return run((tx) => m.reviewPensionPayment(tx, paymentId, parsed.data));
}

// Lo que responde la base cuando el comensal cancela o pausa (funciones cancel_my_meal y pause_my_pension).
const DINER_MESSAGE: Record<string, string> = {
  not_found: "No encontramos tu pensión. Recarga la página.",
  no_plan: "Tu plan no incluye esa comida ese día.",
  paused: "Ese día tienes la pensión en pausa.",
  no_service: "Ese día la pensión no cocina.",
  closed: "Ya pasó la hora para cancelar. Si necesitas cambiarlo, avísale a la cocina.",
  invalid: "Revisa las fechas: desde hoy y dentro de tu plan.",
  served: "Ya comiste algún día de esas fechas: no se puede pausar.",
  overlap: "Ya tienes una pausa en esas fechas.",
};

async function runDiner(query: ReturnType<typeof sql>): Promise<PensionResult> {
  const claims = await getSessionClaims();
  try {
    const [row] = (await withRls(claims, (tx) => tx.execute(query))) as unknown as { r: string }[];
    if (row?.r !== "ok")
      return { ok: false, message: DINER_MESSAGE[row?.r ?? ""] ?? DINER_MESSAGE.not_found };
    revalidatePath("/mi", "layout");
    revalidatePath("/pension", "layout");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

// El comensal cancela o vuelve a pedir una comida (hasta la hora límite del día anterior; lo controla la base).
export async function cancelMyMealAction(input: unknown): Promise<PensionResult> {
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: DINER_MESSAGE.not_found };
  const { residentId, date, meal, cancel } = parsed.data;
  return runDiner(
    sql`select public.cancel_my_meal(${residentId}::uuid, ${date}::date, ${meal}::public.meal_type, ${cancel}) as r`,
  );
}

// El comensal pausa su pensión por un viaje (PN-15).
export async function pauseMyPensionAction(subscriptionId: string, input: unknown): Promise<PensionResult> {
  if (!isUuid(subscriptionId)) return { ok: false, message: DINER_MESSAGE.not_found };
  const parsed = pauseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { fromDate, toDate } = parsed.data;
  return runDiner(
    sql`select public.pause_my_pension(${subscriptionId}::uuid, ${fromDate}::date, ${toDate}::date) as r`,
  );
}
