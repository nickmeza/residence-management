"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import { MoveError, saveMove } from "./mutations";
import { moveSchema } from "./schemas";

export type MoveResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function saveMoveAction(contractId: string, input: unknown): Promise<MoveResult> {
  if (!isUuid(contractId)) return { ok: false, message: "No encontramos ese contrato. Recarga la página." };
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const claims = await getSessionClaims();
  try {
    await withRls(claims, (tx) => saveMove(tx, contractId, parsed.data, claims.sub));
    revalidatePath("/ingresos", "layout");
    revalidatePath("/panel");
    revalidatePath("/mi", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof MoveError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar. Vuelve a intentarlo." };
  }
}
