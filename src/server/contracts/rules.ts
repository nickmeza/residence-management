// Reglas de negocio de los contratos (docs/reglas-de-negocio.md). Funciones puras.
import { askedRequirements, type RequirementRule, type UnitType } from "@/server/documents/rules";

import { daysBetween, periodsOverlap, type IsoDate } from "./dates";

export type ContractStatus = "draft" | "pending_signature" | "confirmed" | "cancelled";
export type ContractPaperwork = "none" | "paper" | "template";

export type ContractInput = {
  id: string;
  unitId: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  status: ContractStatus;
};

// Días antes del fin en que un contrato pasa a "por vencer". Es un ejemplo: el dueño puede cambiarlo.
export const ENDING_SOON_DAYS = 30;

// Cómo se ve un contrato hoy. Vigente, por vencer y terminado no se guardan: salen de las fechas.
// "Por iniciar" es un contrato confirmado cuya fecha de inicio todavía no llega.
export type ContractPhase =
  "draft" | "pending_signature" | "cancelled" | "upcoming" | "active" | "ending_soon" | "ended";

export function contractPhase(
  contract: Pick<ContractInput, "status" | "startDate" | "endDate">,
  today: IsoDate,
  endingSoonDays = ENDING_SOON_DAYS,
): ContractPhase {
  if (contract.status !== "confirmed") return contract.status;
  if (today < contract.startDate) return "upcoming";
  if (contract.endDate === null) return "active";
  if (today > contract.endDate) return "ended";
  return daysBetween(today, contract.endDate) <= endingSoonDays ? "ending_soon" : "active";
}

export const PHASE_LABEL: Record<ContractPhase, string> = {
  draft: "Borrador",
  pending_signature: "Pendiente de firma",
  cancelled: "Cancelado",
  upcoming: "Por iniciar",
  active: "Vigente",
  ending_soon: "Por vencer",
  ended: "Terminado",
};

// "Confirmado" se muestra según haya papel o no.
export const confirmedLabel = (paperwork: ContractPaperwork) =>
  paperwork === "none" ? "Acordado" : "Firmado";

// ¿Ocupa la unidad? Un contrato pendiente de firma también: el residente ya puede vivir ahí
// aunque el papel firmado no se haya subido. Borradores y cancelados no ocupan nada.
const holdsUnit = (status: ContractStatus) => status === "pending_signature" || status === "confirmed";

// ¿Tiene la unidad a alguien viviendo hoy? Alimenta el estado "Ocupado" de la unidad.
export function occupiesToday(contract: ContractInput, today: IsoDate): boolean {
  return holdsUnit(contract.status) && periodsOverlap(contract, { startDate: today, endDate: today });
}

// Unidades que no se pueden alquilar a la vez que `unitId`: ella misma, su departamento y sus cuartos.
// Departamento completo y por cuartos son excluyentes, pero el modo puede cambiar con el tiempo.
export function relatedUnitIds(
  unitId: string,
  units: { id: string; parentId: string | null }[],
): Set<string> {
  const related = new Set([unitId]);
  const parentId = units.find((u) => u.id === unitId)?.parentId;
  if (parentId) related.add(parentId);
  for (const u of units) if (u.parentId === unitId) related.add(u.id);
  return related;
}

// Regla 4: una unidad no puede tener dos contratos vigentes con fechas que se solapen.
// Devuelve los contratos con los que choca `candidate` (vacío = se puede).
export function overlappingContracts(
  candidate: Pick<ContractInput, "id" | "unitId" | "startDate" | "endDate">,
  others: ContractInput[],
  units: { id: string; parentId: string | null }[],
): ContractInput[] {
  const related = relatedUnitIds(candidate.unitId, units);
  return others.filter(
    (c) =>
      c.id !== candidate.id && holdsUnit(c.status) && related.has(c.unitId) && periodsOverlap(candidate, c),
  );
}

export type ConfirmProblem =
  | { code: "wrong_status" }
  | { code: "signed_copy_missing" }
  | { code: "required_documents_missing"; requirementIds: string[] };

// Regla 10: solo se confirma con los documentos que se le piden verificados (obligatorios, activos, de la lista
// de lo que alquila y sin excepción). Con papel o plantilla, además, tiene que estar subida la copia firmada.
export function confirmProblems(input: {
  contract: { status: ContractStatus; paperwork: ContractPaperwork; unitType: UnitType };
  requirements: RequirementRule[];
  exemptIds: readonly string[];
  documents: {
    kind: "requirement" | "signed_contract" | "other";
    requirementId: string | null;
    status: "in_review" | "verified" | "rejected";
  }[];
}): ConfirmProblem[] {
  const { contract, requirements, exemptIds, documents } = input;
  const problems: ConfirmProblem[] = [];
  if (contract.status !== "draft" && contract.status !== "pending_signature")
    problems.push({ code: "wrong_status" });

  if (
    contract.paperwork !== "none" &&
    !documents.some((d) => d.kind === "signed_contract" && d.status !== "rejected")
  ) {
    problems.push({ code: "signed_copy_missing" });
  }

  const verified = new Set(documents.filter((d) => d.status === "verified").map((d) => d.requirementId));
  const missing = askedRequirements(requirements, contract.unitType, exemptIds)
    .filter((r) => !verified.has(r.id))
    .map((r) => r.id);
  if (missing.length > 0) problems.push({ code: "required_documents_missing", requirementIds: missing });

  return problems;
}

// Al terminar de llenar un borrador: sin papel queda acordado; con papel espera la copia firmada.
export const statusAfterDraft = (paperwork: ContractPaperwork): ContractStatus =>
  paperwork === "none" ? "confirmed" : "pending_signature";
