// Filtros de la lista de Garantías. Funciones puras (se prueban sin pantalla).
import type { ContractPhase } from "@/server/contracts/rules";
import { fold } from "@/server/payments/collections-filter";

import type { DepositPhase } from "./rules";

export type DepositFilter = "unpaid" | "held" | "to_settle" | "settling" | "returned";

export const DEPOSIT_FILTERS: { id: DepositFilter; label: string }[] = [
  { id: "unpaid", label: "Por cobrar" },
  { id: "held", label: "Retenidas" },
  { id: "to_settle", label: "Por liquidar (contrato termina)" },
  { id: "settling", label: "En liquidación" },
  { id: "returned", label: "Devueltas" },
];

type Row = { phase: DepositPhase; contractPhase: ContractPhase; residentName: string; unitName: string };

// "Por liquidar": la garantía sigue retenida y el contrato termina pronto o ya terminó (aparece el botón Liquidar).
export const needsSettlement = (r: Pick<Row, "phase" | "contractPhase">) =>
  (r.phase === "held" || r.phase === "settling" || r.phase === "disputed") &&
  (r.contractPhase === "ending_soon" || r.contractPhase === "ended");

export function matchesDepositFilter(r: Pick<Row, "phase" | "contractPhase">, filter: DepositFilter) {
  if (filter === "to_settle") return needsSettlement(r);
  if (filter === "settling") return r.phase === "settling" || r.phase === "disputed";
  return r.phase === filter;
}

// Sin filtros marcados, todas. Con varios, las que cumplan cualquiera. La búsqueda mira residente y unidad.
export function filterDeposits<T extends Row>(rows: T[], filters: DepositFilter[], query: string): T[] {
  const q = fold(query.trim());
  return rows.filter(
    (r) =>
      (filters.length === 0 || filters.some((f) => matchesDepositFilter(r, f))) &&
      (q === "" || fold(`${r.residentName} ${r.unitName}`).includes(q)),
  );
}
