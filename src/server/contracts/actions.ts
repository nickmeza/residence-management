"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import * as m from "./mutations";
import { contractSchema, endDateSchema, paperworkSchema, termsSchema } from "./schemas";

// Acciones de contratos. Validan, corren con la sesión (RLS) y vuelven a dibujar las pantallas afectadas.

export type ContractResult =
  { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const NOT_FOUND = "No encontramos ese contrato. Recarga la página.";

async function run(change: Parameters<typeof withRls<string>>[1]): Promise<ContractResult> {
  const claims = await getSessionClaims();
  try {
    const id = await withRls(claims, change);
    // Un contrato cambia la lista de contratos, el perfil del residente y el estado de la unidad en Edificio.
    revalidatePath("/contratos");
    revalidatePath("/residentes", "layout");
    revalidatePath("/edificio", "layout");
    revalidatePath(`/contratos/${id}`);
    return { ok: true, id };
  } catch (e) {
    if (e instanceof m.ContractError) {
      return { ok: false, message: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined };
    }
    console.error(e);
    return { ok: false, message: "No pudimos guardar el contrato. Vuelve a intentarlo." };
  }
}

const invalid = (error: Parameters<typeof issuesByPath>[0]): ContractResult => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: issuesByPath(error),
});

export async function createContractAction(input: unknown, asDraft: boolean): Promise<ContractResult> {
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.createContract(tx, parsed.data, asDraft));
}

export async function submitDraftAction(id: string): Promise<ContractResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  return run(async (tx) => {
    await m.submitDraft(tx, id);
    return id;
  });
}

export async function changePaperworkAction(id: string, input: unknown): Promise<ContractResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = paperworkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx) => {
    await m.changePaperwork(tx, id, parsed.data);
    return id;
  });
}

// Devuelve el id del contrato nuevo.
export async function changeTermsAction(id: string, input: unknown): Promise<ContractResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx) => {
    const next = await m.changeTerms(tx, id, parsed.data);
    revalidatePath(`/contratos/${id}`);
    return next;
  });
}

export async function endContractAction(id: string, endDate: unknown): Promise<ContractResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = endDateSchema.safeParse(endDate);
  if (!parsed.success)
    return {
      ok: false,
      message: "Elige la fecha de fin.",
      fieldErrors: { endDate: "Elige la fecha de fin." },
    };
  return run(async (tx) => {
    await m.endContract(tx, id, parsed.data);
    return id;
  });
}

export async function cancelContractAction(id: string): Promise<ContractResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  return run(async (tx) => {
    await m.cancelContract(tx, id);
    return id;
  });
}
