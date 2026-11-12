"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import * as m from "./mutations";
import { paymentReviewSchema, paymentSchema, type PaymentData } from "./schemas";
import { fileExists } from "./storage";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

// Acciones de pagos. Validan, corren con la sesión (RLS) y vuelven a dibujar Cobros y Mis pagos.

export type PaymentResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

function revalidatePayments(residentId: string, period: string) {
  revalidatePath("/cobros", "layout");
  revalidatePath(`/cobros/${residentId}/${period}`);
  revalidatePath("/residentes", "layout");
  revalidatePath("/garantias", "layout");
  revalidatePath("/mi", "layout");
}

async function save(
  input: unknown,
  change: (tx: Tx, data: PaymentData, userId: string) => Promise<unknown>,
): Promise<PaymentResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  if (parsed.data.proofPath && !(await fileExists(parsed.data.proofPath))) {
    return { ok: false, message: "No encontramos el comprobante subido. Vuelve a subirlo." };
  }
  const claims = await getSessionClaims();
  try {
    await withRls(claims, (tx) => change(tx, parsed.data, claims.sub));
    revalidatePayments(parsed.data.residentId, parsed.data.period);
    return { ok: true };
  } catch (e) {
    if (e instanceof m.PaymentError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el pago. Vuelve a intentarlo." };
  }
}

// PG-02: el arrendador registra un pago con método y, si quiere, comprobante.
export async function registerPaymentAction(input: unknown) {
  return save(input, m.registerPayment);
}

// PG-08: el residente manda su comprobante.
export async function submitProofAction(input: unknown) {
  return save(input, m.submitProof);
}

// PG-09: confirmar o rechazar un comprobante.
export async function reviewPaymentAction(id: string, input: unknown): Promise<PaymentResult> {
  if (!isUuid(id)) return { ok: false, message: "No encontramos ese pago. Recarga la página." };
  const parsed = paymentReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el motivo." };
  const claims = await getSessionClaims();
  try {
    const row = await withRls(claims, (tx) => m.reviewPayment(tx, id, parsed.data, claims.sub));
    revalidatePayments(row.residentId, row.period);
    return { ok: true };
  } catch (e) {
    if (e instanceof m.PaymentError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar la revisión. Vuelve a intentarlo." };
  }
}
