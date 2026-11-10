import "server-only";

import { eq, inArray } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import {
  contract,
  contractTemplate,
  document,
  documentRequirement,
  floor,
  property,
  resident,
  unit,
} from "@/db/schema";
import { isRentable, type UnitInput } from "@/server/building/rules";

import { addDays } from "./dates";
import {
  confirmProblems,
  overlappingContracts,
  statusAfterDraft,
  type ContractPaperwork,
  type ContractStatus,
} from "./rules";
import type { ContractData, TermsData } from "./schemas";

// Cambios de contratos dentro de una transacción con la sesión (RLS). Las acciones validan el formulario antes;
// aquí se revisan las reglas que necesitan la base: solapes, unidad alquilable y documentos obligatorios.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

// Un problema que se le muestra al arrendador (field: el campo del formulario al que se refiere).
export class ContractError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

// Las unidades del negocio dueño de `unitId` y sus contratos (para los solapes y para saber si se alquila).
async function unitContext(tx: Tx, unitId: string) {
  const [target] = await tx
    .select({ businessId: property.businessId, propertyId: property.id })
    .from(unit)
    .innerJoin(floor, eq(floor.id, unit.floorId))
    .innerJoin(property, eq(property.id, floor.propertyId))
    .where(eq(unit.id, unitId))
    .limit(1);
  if (!target) throw new ContractError("Elige una unidad de tu negocio.", "unitId");
  const units = await tx
    .select({
      id: unit.id,
      parentId: unit.parentUnitId,
      type: unit.type,
      name: unit.name,
      rentalMode: unit.rentalMode,
      occupiesWholeFloor: unit.occupiesWholeFloor,
      monthlyPrice: unit.monthlyPrice,
      x: unit.posX,
      z: unit.posZ,
      width: unit.width,
      depth: unit.depth,
    })
    .from(unit)
    .innerJoin(floor, eq(floor.id, unit.floorId))
    .innerJoin(property, eq(property.id, floor.propertyId))
    .where(eq(property.businessId, target.businessId));
  const contracts = await tx
    .select({
      id: contract.id,
      unitId: contract.unitId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
    })
    .from(contract)
    .where(
      inArray(
        contract.unitId,
        units.map((u) => u.id),
      ),
    );
  return { ...target, units: units as UnitInput[], contracts };
}

async function residentBusiness(tx: Tx, residentId: string) {
  const [row] = await tx
    .select({ businessId: resident.businessId })
    .from(resident)
    .where(eq(resident.id, residentId))
    .limit(1);
  if (!row) throw new ContractError("Elige un residente de tu negocio.", "residentId");
  return row.businessId;
}

// Revisa la unidad (de este negocio, alquilable y libre en esas fechas). ignoreIds: el contrato que se reemplaza.
// Un borrador no ocupa la unidad: puede cruzarse con otros y se revisa al confirmarlo (checkOverlap = false).
async function checkUnit(
  tx: Tx,
  terms: Pick<TermsData, "unitId" | "startDate" | "endDate">,
  businessId: string,
  ignoreIds: string[] = [],
  checkOverlap = true,
) {
  const ctx = await unitContext(tx, terms.unitId);
  if (ctx.businessId !== businessId) throw new ContractError("Elige una unidad de este negocio.", "unitId");
  const byId = new Map(ctx.units.map((u) => [u.id, u]));
  const target = byId.get(terms.unitId)!;
  if (!isRentable(target, byId)) {
    throw new ContractError(
      target.type === "apartment"
        ? "Este departamento se alquila por cuartos: elige uno de sus cuartos."
        : "Este cuarto va incluido en su departamento: elige el departamento.",
      "unitId",
    );
  }
  const clash = overlappingContracts(
    { id: "", ...terms },
    ctx.contracts.filter((c) => !ignoreIds.includes(c.id)),
    ctx.units,
  );
  if (checkOverlap && clash.length) {
    throw new ContractError("Esa unidad ya tiene un contrato en esas fechas.", "startDate");
  }
  return ctx;
}

async function checkTemplate(tx: Tx, templateId: string | null, businessId: string) {
  if (!templateId) return;
  const [t] = await tx
    .select({ businessId: contractTemplate.businessId })
    .from(contractTemplate)
    .where(eq(contractTemplate.id, templateId))
    .limit(1);
  if (!t || t.businessId !== businessId)
    throw new ContractError("Elige una plantilla de tu negocio.", "templateId");
}

// Estado al terminar de llenar el contrato. Sin papel queda acordado, pero solo si los documentos obligatorios
// están verificados (regla 10); con papel queda pendiente de la copia firmada.
async function nextStatus(
  tx: Tx,
  input: { paperwork: ContractPaperwork; residentId: string; businessId: string; propertyId: string },
): Promise<{ status: ContractStatus; confirmedAt: Date | null }> {
  const status = statusAfterDraft(input.paperwork);
  if (status !== "confirmed") return { status, confirmedAt: null };
  const [requirements, documents] = await Promise.all([
    tx
      .select({
        id: documentRequirement.id,
        propertyId: documentRequirement.propertyId,
        required: documentRequirement.required,
      })
      .from(documentRequirement)
      .where(eq(documentRequirement.businessId, input.businessId)),
    tx
      .select({ kind: document.kind, requirementId: document.requirementId, status: document.status })
      .from(document)
      .where(eq(document.residentId, input.residentId)),
  ]);
  const problems = confirmProblems({
    contract: { status: "draft", paperwork: input.paperwork, propertyId: input.propertyId },
    requirements,
    documents,
  });
  if (problems.some((p) => p.code === "required_documents_missing")) {
    throw new ContractError(
      "Faltan documentos obligatorios verificados. Guárdalo como borrador y confírmalo cuando estén.",
    );
  }
  return { status, confirmedAt: new Date() };
}

// Crea un contrato. Como borrador no ocupa la unidad; si no, queda acordado o pendiente de firma.
export async function createContract(tx: Tx, data: ContractData, asDraft: boolean) {
  const businessId = await residentBusiness(tx, data.residentId);
  const ctx = await checkUnit(tx, data, businessId, [], !asDraft);
  await checkTemplate(tx, data.templateId, businessId);
  const state = asDraft
    ? { status: "draft" as const, confirmedAt: null }
    : await nextStatus(tx, { ...data, businessId, propertyId: ctx.propertyId });
  const [row] = await tx
    .insert(contract)
    .values({ ...data, ...state })
    .returning({ id: contract.id });
  return row.id;
}

// El contrato con lo necesario para cambiarlo. Error si no es de un negocio de quien inició sesión.
async function findContract(tx: Tx, id: string) {
  const [row] = await tx
    .select({
      id: contract.id,
      residentId: contract.residentId,
      unitId: contract.unitId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      paperwork: contract.paperwork,
      status: contract.status,
      businessId: resident.businessId,
    })
    .from(contract)
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .where(eq(contract.id, id))
    .limit(1);
  if (!row) throw new ContractError("No encontramos ese contrato. Recarga la página.");
  return row;
}

// Un borrador pasa a acordado o pendiente de firma. Recién aquí ocupa la unidad, así que se vuelve a revisar.
export async function submitDraft(tx: Tx, id: string) {
  const c = await findContract(tx, id);
  if (c.status !== "draft") throw new ContractError("Este contrato ya no es un borrador.");
  const ctx = await checkUnit(tx, c, c.businessId, [c.id]);
  const state = await nextStatus(tx, { ...c, propertyId: ctx.propertyId });
  await tx.update(contract).set(state).where(eq(contract.id, id));
}

// Cambia solo el papel del mismo alquiler (por ejemplo, era mes a mes sin contrato y el residente pide una copia).
// Con papel vuelve a quedar pendiente de la copia firmada; el residente sigue ocupando la unidad.
export async function changePaperwork(
  tx: Tx,
  id: string,
  input: { paperwork: ContractPaperwork; templateId: string | null },
) {
  const c = await findContract(tx, id);
  if (c.status === "cancelled") throw new ContractError("No se puede cambiar un contrato cancelado.");
  await checkTemplate(tx, input.templateId, c.businessId);
  if (c.status === "draft") {
    await tx.update(contract).set(input).where(eq(contract.id, id));
    return;
  }
  const ctx = await unitContext(tx, c.unitId);
  const state = await nextStatus(tx, {
    ...input,
    residentId: c.residentId,
    businessId: c.businessId,
    propertyId: ctx.propertyId,
  });
  await tx
    .update(contract)
    .set({ ...input, ...state })
    .where(eq(contract.id, id));
}

// Cambian las condiciones (renta, unidad, fechas…): el contrato actual termina el día anterior y empieza uno
// nuevo enlazado a él. Así queda claro qué había antes y qué hay ahora.
export async function changeTerms(tx: Tx, id: string, terms: TermsData) {
  const c = await findContract(tx, id);
  if (c.status !== "confirmed" && c.status !== "pending_signature") {
    throw new ContractError(
      "Solo se cambian las condiciones de un contrato acordado, firmado o pendiente de firma.",
    );
  }
  if (terms.startDate <= c.startDate) {
    throw new ContractError("El contrato nuevo debe empezar después del inicio del actual.", "startDate");
  }
  if (c.endDate && terms.startDate > addDays(c.endDate, 1)) {
    throw new ContractError(
      "El contrato nuevo debe empezar, como tarde, el día siguiente al fin del actual.",
      "startDate",
    );
  }
  const ctx = await checkUnit(tx, terms, c.businessId, [c.id]);
  await checkTemplate(tx, terms.templateId, c.businessId);
  const state = await nextStatus(tx, {
    ...terms,
    residentId: c.residentId,
    businessId: c.businessId,
    propertyId: ctx.propertyId,
  });
  await tx
    .update(contract)
    .set({ endDate: addDays(terms.startDate, -1) })
    .where(eq(contract.id, id));
  const [row] = await tx
    .insert(contract)
    .values({ ...terms, residentId: c.residentId, renewedFromId: c.id, ...state })
    .returning({ id: contract.id });
  return row.id;
}

// Termina antes de tiempo (o pone fin a uno mes a mes): se cambia la fecha de fin.
export async function endContract(tx: Tx, id: string, endDate: string) {
  const c = await findContract(tx, id);
  if (c.status !== "confirmed" && c.status !== "pending_signature") {
    throw new ContractError("Solo se termina un contrato acordado, firmado o pendiente de firma.");
  }
  if (endDate < c.startDate) throw new ContractError("El fin no puede ser antes del inicio.", "endDate");
  if (c.endDate && endDate > c.endDate) {
    throw new ContractError("Para alargarlo, usa Cambiar condiciones.", "endDate");
  }
  await tx.update(contract).set({ endDate }).where(eq(contract.id, id));
}

// Cancela un borrador o un contrato que no llegó a firmarse. Uno acordado o firmado se termina, no se cancela,
// para no borrar que el residente vivió ahí.
export async function cancelContract(tx: Tx, id: string) {
  const c = await findContract(tx, id);
  if (c.status !== "draft" && c.status !== "pending_signature") {
    throw new ContractError("Un contrato acordado o firmado no se cancela: termínalo con una fecha de fin.");
  }
  await tx.update(contract).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(contract.id, id));
}
