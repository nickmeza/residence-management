// Cómo se ve cada residente en la lista: su contrato de ahora y cómo van sus documentos. Funciones puras.
import type { IsoDate } from "@/server/contracts/dates";
import {
  contractPhase,
  occupiesToday,
  type ContractInput,
  type ContractPhase,
} from "@/server/contracts/rules";

// El contrato que se muestra: el que ocupa la unidad hoy; si no hay, el próximo por empezar;
// si tampoco, el más reciente. Los cancelados solo si no hay otro.
export function currentContract<T extends ContractInput>(contracts: T[], today: IsoDate): T | null {
  const byStartDesc = [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    byStartDesc.find((c) => occupiesToday(c, today)) ??
    [...byStartDesc]
      .reverse()
      .find((c) => (c.status === "confirmed" || c.status === "pending_signature") && c.startDate > today) ??
    byStartDesc.find((c) => c.status !== "cancelled") ??
    byStartDesc[0] ??
    null
  );
}

export type DocumentsSummary = { missing: number; inReview: number };

// Faltan: requisitos obligatorios (del negocio o de la propiedad del contrato) sin documento verificado
// ni en revisión. En revisión: documentos que el arrendador todavía no revisó.
export function documentsSummary(input: {
  propertyId: string | null;
  requirements: { id: string; propertyId: string | null; required: boolean }[];
  documents: { requirementId: string | null; status: "in_review" | "verified" | "rejected" }[];
}): DocumentsSummary {
  const sent = new Set(input.documents.filter((d) => d.status !== "rejected").map((d) => d.requirementId));
  const missing = input.requirements.filter(
    (r) => r.required && (r.propertyId === null || r.propertyId === input.propertyId) && !sent.has(r.id),
  ).length;
  const inReview = input.documents.filter((d) => d.status === "in_review").length;
  return { missing, inReview };
}

export type ResidentFilter = "all" | "ending_soon" | "documents";

export type ResidentRow = {
  id: string;
  fullName: string;
  phase: ContractPhase | null;
  unitName: string | null;
  searchText: string;
  documents: DocumentsSummary;
};

export function matchesFilter(row: ResidentRow, filter: ResidentFilter): boolean {
  if (filter === "ending_soon") return row.phase === "ending_soon";
  if (filter === "documents") return row.documents.missing > 0 || row.documents.inReview > 0;
  return true;
}

// Busca por nombre o unidad, sin importar mayúsculas ni tildes ("maria" encuentra "María").
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function matchesSearch(row: ResidentRow, query: string): boolean {
  const q = fold(query.trim());
  return q === "" || fold(row.searchText).includes(q);
}

// ¿Cuenta como residente activo? Vive hoy o está por entrar.
export const isActivePhase = (phase: ContractPhase | null) =>
  phase === "active" || phase === "ending_soon" || phase === "upcoming" || phase === "pending_signature";

// Fase del contrato de ahora (null = sin contrato).
export const currentPhase = (contract: ContractInput | null, today: IsoDate) =>
  contract ? contractPhase(contract, today) : null;
