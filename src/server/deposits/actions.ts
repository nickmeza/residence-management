"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";
import {
  discountSchema,
  disputeAnswerSchema,
  disputeSchema,
  entryReportSchema,
  refundSchema,
  settlementResponseSchema,
} from "@/server/payments/schemas";
import { fileExists } from "@/server/payments/storage";

import * as m from "./mutations";

// Acciones de la garantía: liquidar (arrendador) y responder o reportar lo de ingreso (residente).

export type DepositResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

const NOT_FOUND = "No encontramos esa garantía. Recarga la página.";

// Pantallas que muestran la garantía: Garantías, su detalle, Cobros (el cargo por daños) y el lado del residente.
function revalidateDeposit(depositId?: string) {
  revalidatePath("/garantias");
  if (depositId) revalidatePath(`/garantias/${depositId}`);
  revalidatePath("/cobros", "layout");
  revalidatePath("/mi", "layout");
}

async function run(
  change: (tx: Tx, userId: string) => Promise<unknown>,
  depositId?: string,
): Promise<DepositResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, (tx) => change(tx, claims.sub));
    revalidateDeposit(depositId);
    return { ok: true };
  } catch (e) {
    if (e instanceof m.DepositError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

const invalid = (error: Parameters<typeof issuesByPath>[0]): DepositResult => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: issuesByPath(error),
});

export async function startSettlementAction(depositId: string) {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND } as DepositResult;
  return run((tx) => m.startSettlement(tx, depositId), depositId);
}

export async function addDiscountAction(depositId: string, input: unknown): Promise<DepositResult> {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND };
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.photoPath && !(await fileExists(parsed.data.photoPath))) {
    return { ok: false, message: "No encontramos la foto subida. Vuelve a subirla." };
  }
  return run((tx) => m.addDiscount(tx, depositId, parsed.data), depositId);
}

export async function deleteDiscountAction(depositId: string, discountId: string): Promise<DepositResult> {
  if (!isUuid(depositId) || !isUuid(discountId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.deleteDiscount(tx, discountId), depositId);
}

export async function sendSettlementAction(depositId: string): Promise<DepositResult> {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.sendSettlement(tx, depositId), depositId);
}

export async function answerDisputeAction(
  depositId: string,
  discountId: string,
  input: unknown,
): Promise<DepositResult> {
  if (!isUuid(depositId) || !isUuid(discountId)) return { ok: false, message: NOT_FOUND };
  const parsed = disputeAnswerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.answerDispute(tx, discountId, parsed.data), depositId);
}

export async function registerRefundAction(depositId: string, input: unknown): Promise<DepositResult> {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND };
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.proofPath && !(await fileExists(parsed.data.proofPath))) {
    return { ok: false, message: "No encontramos el comprobante subido. Vuelve a subirlo." };
  }
  return run((tx, userId) => m.registerRefund(tx, depositId, parsed.data, userId), depositId);
}

export async function chargeExcessAction(depositId: string): Promise<DepositResult> {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.chargeExcess(tx, depositId), depositId);
}

export async function waiveExcessAction(depositId: string): Promise<DepositResult> {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.waiveExcess(tx, depositId), depositId);
}

export async function closeSettlementAction(depositId: string): Promise<DepositResult> {
  if (!isUuid(depositId)) return { ok: false, message: NOT_FOUND };
  return run((tx) => m.closeSettlement(tx, depositId), depositId);
}

// --- Residente ---

export async function addEntryReportAction(input: unknown): Promise<DepositResult> {
  const parsed = entryReportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await fileExists(parsed.data.photoPath))) {
    return { ok: false, message: "No encontramos la foto subida. Vuelve a subirla." };
  }
  return run((tx, userId) => m.addEntryReport(tx, parsed.data, userId));
}

export async function respondSettlementAction(settlementId: string, input: unknown): Promise<DepositResult> {
  if (!isUuid(settlementId)) return { ok: false, message: NOT_FOUND };
  const parsed = settlementResponseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.respondSettlement(tx, settlementId, parsed.data));
}

export async function disputeDiscountAction(discountId: string, input: unknown): Promise<DepositResult> {
  if (!isUuid(discountId)) return { ok: false, message: NOT_FOUND };
  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.disputeDiscount(tx, discountId, parsed.data.reason));
}
