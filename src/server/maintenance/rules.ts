// Reglas de mantenimiento (MT-01 a MT-07). Funciones puras: estados, prioridades y qué cambio está permitido.

export type MaintenanceStatus = "open" | "in_progress" | "done" | "cancelled";
export type MaintenancePriority = "low" | "normal" | "high" | "urgent";
export type MaintenanceCategory =
  "plumbing" | "electrical" | "furniture" | "appliance" | "internet" | "cleaning" | "other";

export const STATUS_VALUES = ["open", "in_progress", "done", "cancelled"] as const;
export const PRIORITY_VALUES = ["low", "normal", "high", "urgent"] as const;
export const CATEGORY_VALUES = [
  "plumbing",
  "electrical",
  "furniture",
  "appliance",
  "internet",
  "cleaning",
  "other",
] as const;

// Cómo se escribe cada estado en la dirección (?filtro=pendientes,en-curso).
export const STATUS_SLUGS: Record<MaintenanceStatus, string> = {
  open: "pendientes",
  in_progress: "en-curso",
  done: "resueltos",
  cancelled: "cancelados",
};

export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  open: "Pendiente",
  in_progress: "En curso",
  done: "Resuelto",
  cancelled: "Cancelado",
};

export const PRIORITY_LABEL: Record<MaintenancePriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  plumbing: "Agua y desagüe",
  electrical: "Luz y enchufes",
  furniture: "Muebles, puertas y ventanas",
  appliance: "Artefactos (terma, refrigeradora…)",
  internet: "Internet",
  cleaning: "Limpieza",
  other: "Otro",
};

// Abierto o en curso: todavía hay que hacer algo.
export const isActive = (status: MaintenanceStatus) => status === "open" || status === "in_progress";

// Resuelto o cancelado ya no cambia de estado (si vuelve a fallar, se pide uno nuevo).
export function statusProblem(from: MaintenanceStatus, to: MaintenanceStatus): string | null {
  if (from === to) return null;
  if (!isActive(from)) return "Este pedido ya está cerrado. Si vuelve a fallar, crea uno nuevo.";
  return null;
}

// La unidad se ve "Mantenimiento" mientras tenga un pedido activo que la deja fuera de servicio.
export const blocksUnitNow = (r: { status: MaintenanceStatus; blocksUnit: boolean }) =>
  r.blocksUnit && isActive(r.status);

const PRIORITY_RANK: Record<MaintenancePriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_RANK: Record<MaintenanceStatus, number> = { open: 0, in_progress: 1, done: 2, cancelled: 3 };

// Orden de la lista (MT-02): primero lo activo, por prioridad y luego lo más antiguo (lo que más espera).
export function compareRequests(
  a: { status: MaintenanceStatus; priority: MaintenancePriority; createdAt: Date },
  b: { status: MaintenanceStatus; priority: MaintenancePriority; createdAt: Date },
) {
  const activeA = isActive(a.status) ? 0 : 1;
  const activeB = isActive(b.status) ? 0 : 1;
  if (activeA !== activeB) return activeA - activeB;
  if (activeA === 0) {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p) return p;
    const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (s) return s;
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  // Lo cerrado: lo más reciente primero.
  return b.createdAt.getTime() - a.createdAt.getTime();
}

// Prioridad que pone el residente: solo "Normal" o "Urgente" (el arrendador la puede cambiar después).
export const RESIDENT_PRIORITIES = ["normal", "urgent"] as const;
