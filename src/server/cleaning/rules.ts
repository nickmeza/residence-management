// Limpieza (MT-05). Funciones puras: etiquetas y qué cambio de un pedido está permitido.

export type CleaningStatus = "clean" | "dirty" | "inspected";
export type CleaningRequestStatus = "requested" | "scheduled" | "done" | "cancelled";

export const CLEANING_VALUES = ["clean", "dirty", "inspected"] as const;

export const CLEANING_LABEL: Record<CleaningStatus, string> = {
  dirty: "Por limpiar",
  clean: "Limpio",
  inspected: "Revisado",
};

export const REQUEST_LABEL: Record<CleaningRequestStatus, string> = {
  requested: "Pedido",
  scheduled: "Con fecha",
  done: "Hecho",
  cancelled: "Cancelado",
};

export const isOpenRequest = (s: CleaningRequestStatus) => s === "requested" || s === "scheduled";

// Lo hecho o cancelado ya no cambia (si quiere otra limpieza, la pide de nuevo).
export function requestProblem(from: CleaningRequestStatus, to: CleaningRequestStatus): string | null {
  if (!isOpenRequest(from)) return "Este pedido ya está cerrado.";
  if (to === "requested") return "Elige una fecha, márcalo hecho o cancélalo.";
  return null;
}

const RANK: Record<CleaningStatus, number> = { dirty: 0, clean: 1, inspected: 2 };

// Primero lo que hay que limpiar.
export const compareUnits = (
  a: { status: CleaningStatus; label: string },
  b: { status: CleaningStatus; label: string },
) => RANK[a.status] - RANK[b.status] || a.label.localeCompare(b.label, "es");
