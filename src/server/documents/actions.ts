"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import * as m from "./mutations";
import { requirementSchema } from "./schemas";

// Acciones de Configuración › Documentos. Validan y corren con la sesión (RLS).

export type RequirementResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const NOT_FOUND = "No encontramos ese documento. Recarga la página.";

// Corre el cambio y vuelve a dibujar Documentos y Residentes (la lista cuenta los documentos que faltan).
async function run(change: () => Promise<string>): Promise<RequirementResult> {
  try {
    const businessId = await change();
    revalidatePath(`/negocio/${businessId}/documentos`);
    revalidatePath("/residentes", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof m.DocumentError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

export async function saveRequirementAction(
  target: { businessId: string; requirementId: string | null },
  input: unknown,
): Promise<RequirementResult> {
  if (!isUuid(target.businessId) || (target.requirementId && !isUuid(target.requirementId))) {
    return { ok: false, message: NOT_FOUND };
  }
  const parsed = requirementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const claims = await getSessionClaims();
  const { requirementId } = target;
  return run(() =>
    withRls(claims, async (tx) => {
      if (requirementId) return m.updateRequirement(tx, requirementId, parsed.data);
      await m.createRequirement(tx, target.businessId, parsed.data);
      return target.businessId;
    }),
  );
}

export async function deleteRequirementAction(id: string): Promise<RequirementResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const claims = await getSessionClaims();
  return run(() => withRls(claims, (tx) => m.deleteRequirement(tx, id)));
}
