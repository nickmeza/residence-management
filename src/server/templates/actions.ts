"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import * as m from "./mutations";
import { templateSchema } from "./schemas";

// Acciones de Configuración › Plantillas. Validan y corren con la sesión (RLS).

export type TemplateResult =
  { ok: true; id: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const NOT_FOUND = "No encontramos esa plantilla. Recarga la página.";

// Corre el cambio y vuelve a dibujar Plantillas y Contratos (el formulario de contrato lista las plantillas).
async function run(change: () => Promise<{ id: string; businessId: string }>): Promise<TemplateResult> {
  try {
    const { id, businessId } = await change();
    revalidatePath(`/negocio/${businessId}/plantillas`);
    revalidatePath("/contratos", "layout");
    return { ok: true, id };
  } catch (e) {
    if (e instanceof m.TemplateError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar la plantilla. Vuelve a intentarlo." };
  }
}

export async function saveTemplateAction(
  target: { businessId: string; templateId: string | null },
  input: unknown,
): Promise<TemplateResult> {
  if (!isUuid(target.businessId) || (target.templateId && !isUuid(target.templateId))) {
    return { ok: false, message: NOT_FOUND };
  }
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const claims = await getSessionClaims();
  const { templateId } = target;
  return run(() =>
    withRls(claims, async (tx) =>
      templateId
        ? { id: templateId, businessId: await m.updateTemplate(tx, templateId, parsed.data) }
        : { id: await m.createTemplate(tx, target.businessId, parsed.data), businessId: target.businessId },
    ),
  );
}

export async function deleteTemplateAction(id: string): Promise<TemplateResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const claims = await getSessionClaims();
  return run(() => withRls(claims, async (tx) => ({ id, businessId: await m.deleteTemplate(tx, id) })));
}
