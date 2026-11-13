// Filtros de la lista de Contratos. Funciones puras (se prueban sin pantalla).
import { fold } from "@/server/payments/collections-filter";

import type { ContractPhase } from "./rules";

export type ContractFilter = "active" | "ending_soon" | "pending" | "ended";

export const CONTRACT_FILTERS: { id: ContractFilter; label: string; phases: ContractPhase[] }[] = [
  { id: "active", label: "Vigentes", phases: ["active", "ending_soon"] },
  { id: "ending_soon", label: "Por vencer", phases: ["ending_soon"] },
  { id: "pending", label: "Por cerrar (borrador o por firmar)", phases: ["draft", "pending_signature"] },
  { id: "ended", label: "Terminados", phases: ["ended", "cancelled"] },
];

export const matchesContractFilter = (row: { phase: ContractPhase }, filter: ContractFilter) =>
  CONTRACT_FILTERS.find((f) => f.id === filter)!.phases.includes(row.phase);

// Sin filtros marcados, todos. Con varios, los que cumplan cualquiera. La búsqueda mira residente y unidad.
export function filterContracts<T extends { phase: ContractPhase; searchText: string }>(
  rows: T[],
  filters: ContractFilter[],
  query: string,
): T[] {
  const q = fold(query.trim());
  return rows.filter(
    (r) =>
      (filters.length === 0 || filters.some((f) => matchesContractFilter(r, f))) &&
      (q === "" || fold(r.searchText).includes(q)),
  );
}
