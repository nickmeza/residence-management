// Filtros de la lista de Cobros y el aviso de comprobantes por revisar. Funciones puras (se prueban sin pantalla).
import type { Period, ReceiptStatus } from "./rules";

export type ReceiptFilter = "paid" | "pending" | "overdue" | "review";

export const RECEIPT_FILTERS: { id: ReceiptFilter; label: string }[] = [
  { id: "paid", label: "Pagados" },
  { id: "pending", label: "Pendientes" },
  { id: "overdue", label: "Vencidos" },
  { id: "review", label: "Con comprobante por revisar" },
];

type Filterable = { status: ReceiptStatus; inReview: number; residentName: string; units: string[] };

// "Con comprobante por revisar" mira los comprobantes pendientes, no el estado del recibo: un recibo en
// "Pago parcial" puede tener además un comprobante esperando.
export function matchesFilter(r: Pick<Filterable, "status" | "inReview">, filter: ReceiptFilter): boolean {
  if (filter === "review") return r.inReview > 0;
  if (filter === "paid") return r.status === "paid";
  if (filter === "pending") return r.status === "pending" || r.status === "partial";
  return r.status === "overdue";
}

// Sin tildes ni mayúsculas, para buscar "lucia" y encontrar "Lucía".
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Sin filtros marcados, todos. Con varios, los que cumplan cualquiera. La búsqueda mira nombre y unidad.
export function filterReceipts<T extends Filterable>(
  receipts: T[],
  filters: ReceiptFilter[],
  query: string,
): T[] {
  const q = fold(query.trim());
  return receipts.filter(
    (r) =>
      (filters.length === 0 || filters.some((f) => matchesFilter(r, f))) &&
      (q === "" || fold(`${r.residentName} ${r.units.join(" ")}`).includes(q)),
  );
}

// ¿Hay algo que registrar este mes? Si no, "Registrar pago" avisa que todo está pagado.
export const hasPayable = (receipts: { status: ReceiptStatus }[]) =>
  receipts.some((r) => r.status !== "paid");

// El aviso de comprobantes por revisar: cuántos hay en total y cuántos son de otros meses (la tabla muestra uno solo).
export function reviewSummary(toReview: { period: Period }[], period: Period) {
  const others = new Map<Period, number>();
  for (const p of toReview) if (p.period !== period) others.set(p.period, (others.get(p.period) ?? 0) + 1);
  return {
    total: toReview.length,
    thisMonth: toReview.length - [...others.values()].reduce((a, b) => a + b, 0),
    others: [...others].sort(([a], [b]) => a.localeCompare(b)).map(([p, count]) => ({ period: p, count })),
  };
}
