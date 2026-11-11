import "server-only";

import { and, eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import {
  business,
  contract,
  document,
  documentRequirement,
  documentRequirementExemption,
  person,
  resident,
} from "@/db/schema";

import { DEFAULT_LIMITS, fileProblem, isPathOf } from "./files";
import type { RequirementData } from "./schemas";

// Cambios de requisitos de documentos dentro de una transacción con la sesión (RLS).

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class DocumentError extends Error {}

const NOT_FOUND = "No encontramos ese documento. Recarga la página.";

export async function createRequirement(tx: Tx, businessId: string, data: RequirementData) {
  const [own] = await tx
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId))
    .limit(1);
  if (!own) throw new DocumentError("No encontramos tu negocio. Recarga la página.");
  const [row] = await tx
    .insert(documentRequirement)
    .values({ businessId, ...data })
    .returning({ id: documentRequirement.id });
  return row.id;
}

export async function updateRequirement(tx: Tx, id: string, data: RequirementData) {
  const [row] = await tx
    .update(documentRequirement)
    .set(data)
    .where(eq(documentRequirement.id, id))
    .returning({ businessId: documentRequirement.businessId });
  if (!row) throw new DocumentError(NOT_FOUND);
  return row.businessId;
}

// Encender o apagar un requisito. Apagado deja de pedirse a todos; los archivos ya subidos se quedan.
export async function setRequirementActive(tx: Tx, id: string, active: boolean) {
  const [row] = await tx
    .update(documentRequirement)
    .set({ active })
    .where(eq(documentRequirement.id, id))
    .returning({ businessId: documentRequirement.businessId });
  if (!row) throw new DocumentError(NOT_FOUND);
  return row.businessId;
}

// Si ya hay archivos subidos para este requisito, se conservan: quedan como "otro documento".
// Va antes de borrar: al borrar, la base deja vacío el enlace y ya no se sabría cuáles eran.
export async function deleteRequirement(tx: Tx, id: string) {
  await tx.update(document).set({ kind: "other" }).where(eq(document.requirementId, id));
  const [row] = await tx
    .delete(documentRequirement)
    .where(eq(documentRequirement.id, id))
    .returning({ businessId: documentRequirement.businessId });
  if (!row) throw new DocumentError(NOT_FOUND);
  return row.businessId;
}

// "Pedírselo" en el perfil del residente. asked = false guarda la excepción; true la quita.
// Devuelve el negocio para volver a dibujar sus pantallas.
export async function setAsked(
  tx: Tx,
  input: { residentId: string; requirementId: string; asked: boolean; userId: string },
) {
  const [card] = await tx
    .select({ businessId: resident.businessId })
    .from(resident)
    .innerJoin(business, eq(business.id, resident.businessId))
    .where(eq(resident.id, input.residentId))
    .limit(1);
  const [req] = await tx
    .select({ businessId: documentRequirement.businessId })
    .from(documentRequirement)
    .where(eq(documentRequirement.id, input.requirementId))
    .limit(1);
  if (!card || !req || req.businessId !== card.businessId) throw new DocumentError(NOT_FOUND);

  if (input.asked) {
    await tx
      .delete(documentRequirementExemption)
      .where(
        and(
          eq(documentRequirementExemption.residentId, input.residentId),
          eq(documentRequirementExemption.requirementId, input.requirementId),
        ),
      );
  } else {
    const [me] = await tx
      .select({ id: person.id })
      .from(person)
      .where(eq(person.userId, input.userId))
      .limit(1);
    await tx
      .insert(documentRequirementExemption)
      .values({ residentId: input.residentId, requirementId: input.requirementId, createdBy: me?.id ?? null })
      .onConflictDoNothing();
  }
  return card.businessId;
}

export type NewDocument = {
  residentId: string;
  kind: "requirement" | "signed_contract" | "other";
  requirementId: string | null;
  contractId: string | null;
  storagePath: string;
  fileName: string;
  // Tipo y tamaño leídos del archivo ya guardado en Storage, no lo que dijo el navegador.
  mimeType: string;
  sizeBytes: number;
};

// Registra un archivo que ya está en el espacio privado. Lo que sube el arrendador queda verificado (él mismo lo
// revisa); lo que sube el residente queda en revisión.
export async function registerDocument(tx: Tx, input: NewDocument, userId: string) {
  const [card] = await tx
    .select({ businessId: resident.businessId })
    .from(resident)
    .where(eq(resident.id, input.residentId))
    .limit(1);
  if (!card) throw new DocumentError("No encontramos esa ficha. Recarga la página.");
  if (!isPathOf(input.storagePath, card.businessId, input.residentId)) {
    throw new DocumentError("No pudimos guardar el archivo. Vuelve a intentarlo.");
  }

  let limits = DEFAULT_LIMITS;
  if (input.kind === "requirement") {
    // El residente solo ve los requisitos obligatorios y activos (RLS): los demás no los encuentra.
    const [req] = input.requirementId
      ? await tx
          .select({
            businessId: documentRequirement.businessId,
            acceptedFormats: documentRequirement.acceptedFormats,
            maxSizeMb: documentRequirement.maxSizeMb,
          })
          .from(documentRequirement)
          .where(eq(documentRequirement.id, input.requirementId))
          .limit(1)
      : [];
    if (!req || req.businessId !== card.businessId) throw new DocumentError(NOT_FOUND);
    limits = req;
  } else if (input.requirementId) {
    throw new DocumentError(NOT_FOUND);
  }
  if (input.kind === "signed_contract") {
    const [c] = input.contractId
      ? await tx
          .select({ residentId: contract.residentId })
          .from(contract)
          .where(eq(contract.id, input.contractId))
          .limit(1)
      : [];
    if (!c || c.residentId !== input.residentId) {
      throw new DocumentError("No encontramos ese contrato. Recarga la página.");
    }
  } else if (input.contractId) {
    throw new DocumentError(NOT_FOUND);
  }

  const problem = fileProblem(input, limits);
  if (problem) throw new DocumentError(problem);

  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  if (!me) throw new DocumentError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
  // El residente no ve el negocio (RLS): si lo encuentra, quien sube es el arrendador.
  const [own] = await tx
    .select({ id: business.id })
    .from(business)
    .where(and(eq(business.id, card.businessId), eq(business.ownerId, me.id)))
    .limit(1);
  const review = own
    ? { status: "verified" as const, reviewedBy: me.id, reviewedAt: new Date() }
    : { status: "in_review" as const };

  const [row] = await tx
    .insert(document)
    .values({ ...input, uploadedBy: me.id, ...review })
    .returning({ id: document.id });
  return { id: row.id, businessId: card.businessId };
}

// Verificar o rechazar (solo el arrendador: el RLS no deja al residente cambiar documentos). Rechazar pide motivo,
// que el residente ve.
export async function reviewDocument(
  tx: Tx,
  id: string,
  decision: { status: "verified" } | { status: "rejected"; reason: string },
  userId: string,
) {
  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  const [row] = await tx
    .update(document)
    .set({
      status: decision.status,
      rejectionReason: decision.status === "rejected" ? decision.reason : null,
      reviewedBy: me?.id ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(document.id, id))
    .returning({ residentId: document.residentId, contractId: document.contractId });
  if (!row) throw new DocumentError(NOT_FOUND);
  return row;
}
