"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import * as m from "./mutations";
import { DOCUMENTS_BUCKET } from "./files";
import { newDocumentSchema, requirementSchema, reviewSchema } from "./schemas";

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

export async function setRequirementActiveAction(id: string, active: boolean): Promise<RequirementResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const claims = await getSessionClaims();
  return run(() => withRls(claims, (tx) => m.setRequirementActive(tx, id, active)));
}

// "Pedírselo" en el perfil del residente.
export async function setAskedAction(input: {
  residentId: string;
  requirementId: string;
  asked: boolean;
}): Promise<RequirementResult> {
  if (!isUuid(input.residentId) || !isUuid(input.requirementId)) return { ok: false, message: NOT_FOUND };
  const claims = await getSessionClaims();
  const result = await run(() =>
    withRls(claims, (tx) => m.setAsked(tx, { ...input, asked: Boolean(input.asked), userId: claims.sub })),
  );
  if (result.ok) revalidatePath(`/residentes/${input.residentId}`);
  return result;
}

export type UploadResult = { ok: true } | { ok: false; message: string };

// Después de que el navegador subió el archivo al espacio privado: se leen su tipo y tamaño reales en Storage
// y se registra. Si no se puede registrar, el archivo se borra (cuando quien sube puede borrar).
export async function registerDocumentAction(input: unknown): Promise<UploadResult> {
  const parsed = newDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos guardar el archivo. Vuelve a intentarlo." };
  const claims = await getSessionClaims();
  const supabase = await createClient();
  const bucket = supabase.storage.from(DOCUMENTS_BUCKET);
  const { storagePath } = parsed.data;
  const folder = storagePath.slice(0, storagePath.lastIndexOf("/"));
  const name = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const { data: found } = await bucket.list(folder, { search: name, limit: 1 });
  const object = found?.find((o) => o.name === name);
  if (!object) return { ok: false, message: "No encontramos el archivo subido. Vuelve a intentarlo." };

  try {
    const { businessId } = await withRls(claims, (tx) =>
      m.registerDocument(
        tx,
        {
          ...parsed.data,
          mimeType: String(object.metadata?.mimetype ?? ""),
          sizeBytes: Number(object.metadata?.size ?? 0),
        },
        claims.sub,
      ),
    );
    revalidateDocuments(parsed.data.residentId, parsed.data.contractId);
    revalidatePath(`/negocio/${businessId}/documentos`);
    return { ok: true };
  } catch (e) {
    await bucket.remove([storagePath]);
    if (e instanceof m.DocumentError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el archivo. Vuelve a intentarlo." };
  }
}

export async function reviewDocumentAction(id: string, input: unknown): Promise<UploadResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el motivo." };
  }
  const claims = await getSessionClaims();
  try {
    const row = await withRls(claims, (tx) => m.reviewDocument(tx, id, parsed.data, claims.sub));
    revalidateDocuments(row.residentId, row.contractId);
    return { ok: true };
  } catch (e) {
    if (e instanceof m.DocumentError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar la revisión. Vuelve a intentarlo." };
  }
}

// Pantallas que muestran documentos: perfil y lista de residentes, el contrato y el lado del residente.
function revalidateDocuments(residentId: string, contractId: string | null) {
  revalidatePath("/residentes", "layout");
  revalidatePath(`/residentes/${residentId}`);
  if (contractId) revalidatePath(`/contratos/${contractId}`);
  revalidatePath("/mi", "layout");
}
