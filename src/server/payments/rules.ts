// Reglas de cobros (docs/reglas-de-negocio.md: recibo único, comprobante de pago). Funciones puras.
// Decisiones del dueño (2026-11-12): los recibos se crean al confirmar el contrato, el mes incompleto se cobra
// proporcional a los días (configurable), se aceptan pagos parciales y no hay mora: solo "Vencido" y días de atraso.
import { daysBetween, type IsoDate } from "@/server/contracts/dates";

import { fromCents, sumCents, toCents, type Cents } from "./money";

// Mes de cobro: "AAAA-MM".
export type Period = string;

export const periodOf = (date: IsoDate): Period => date.slice(0, 7);

export function nextPeriod(period: Period, months = 1): Period {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export const daysInPeriod = (period: Period) => {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

// "2026-03" → "marzo de 2026".
const monthName = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
export const periodLabel = (period: Period) => monthName.format(new Date(`${period}-01T00:00:00Z`));

// Día de pago de un mes. 31 = fin de mes; en meses más cortos, el último día (lo mismo con 29 y 30 en febrero).
export function dueDate(period: Period, paymentDay: number): IsoDate {
  const day = Math.min(paymentDay, daysInPeriod(period));
  return `${period}-${String(day).padStart(2, "0")}`;
}

// Días de atraso para Morosidad (0 si no está vencido).
export function daysLate(due: IsoDate, today: IsoDate): number {
  return Math.max(0, daysBetween(due, today));
}

// Hasta qué mes se crean recibos de un contrato sin fecha de fin (mes a mes): 12 meses desde hoy o desde el inicio.
// Al ponerle fin, los que sobran se quitan. Los de un contrato con fin se crean todos de una vez.
export const OPEN_ENDED_MONTHS = 12;

export type RentCharge = { period: Period; amount: string; dueDate: IsoDate; days: number | null };

// Los cargos de renta de un contrato, uno por mes. Si prorate, el primer y el último mes incompletos se cobran
// por los días que vive ahí (renta × días / días del mes); si no, completos. days = null cuando es el mes completo.
// El día de pago no puede caer antes del inicio ni después del fin del contrato.
export function rentCharges(input: {
  startDate: IsoDate;
  endDate: IsoDate | null;
  monthlyRent: string;
  paymentDay: number;
  prorate: boolean;
  today: IsoDate;
}): RentCharge[] {
  const rent = toCents(input.monthlyRent);
  const first = periodOf(input.startDate);
  const last = input.endDate
    ? periodOf(input.endDate)
    : nextPeriod(
        periodOf(input.today > input.startDate ? input.today : input.startDate),
        OPEN_ENDED_MONTHS - 1,
      );
  const charges: RentCharge[] = [];
  for (let period = first; period <= last; period = nextPeriod(period)) {
    const monthStart = `${period}-01`;
    const monthEnd = `${period}-${String(daysInPeriod(period)).padStart(2, "0")}`;
    const from = input.startDate > monthStart ? input.startDate : monthStart;
    const to = input.endDate && input.endDate < monthEnd ? input.endDate : monthEnd;
    const days = daysBetween(from, to) + 1;
    const partial = days < daysInPeriod(period);
    const amount = partial && input.prorate ? Math.round((rent * days) / daysInPeriod(period)) : rent;
    let due = dueDate(period, input.paymentDay);
    if (due < from) due = from;
    if (due > to) due = to;
    charges.push({
      period,
      amount: fromCents(amount),
      dueDate: due,
      days: partial && input.prorate ? days : null,
    });
  }
  return charges;
}

// Lo que se hace con los cargos de renta que ya existen para que coincidan con los esperados: crear los que
// faltan, corregir el monto o la fecha de los que cambiaron y quitar los que sobran (por ejemplo, al terminar
// antes). Si un recibo quitado ya tenía pagos, queda como saldo a favor en ese mes: no se pierde nada.
export function chargeChanges<T extends { id: string; period: Period; amount: string; dueDate: IsoDate }>(
  existing: T[],
  expected: RentCharge[],
) {
  const byPeriod = new Map(existing.map((c) => [c.period, c]));
  const wanted = new Set(expected.map((c) => c.period));
  return {
    insert: expected.filter((c) => !byPeriod.has(c.period)),
    update: expected
      .filter((c) => {
        const now = byPeriod.get(c.period);
        return now && (toCents(now.amount) !== toCents(c.amount) || now.dueDate !== c.dueDate);
      })
      .map((c) => ({ id: byPeriod.get(c.period)!.id, amount: c.amount, dueDate: c.dueDate })),
    remove: existing.filter((c) => !wanted.has(c.period)).map((c) => c.id),
  };
}

// Estado de un recibo (todo lo que un residente le debe a un negocio en un mes). Vencido, pendiente y pagado no se
// guardan: salen de los cargos, de los pagos confirmados y de la fecha de hoy.
export type ReceiptStatus = "paid" | "partial" | "pending" | "overdue";

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  paid: "Pagado",
  partial: "Pago parcial",
  pending: "Pendiente",
  overdue: "Vencido",
};

// Los pagos se aplican a los cargos en orden de vencimiento. El primero que no queda cubierto da la fecha
// que importa: si ya pasó, el recibo está vencido y cuenta los días de atraso desde ahí.
export function receiptSummary(input: {
  charges: { amount: string; dueDate: IsoDate }[];
  confirmedPayments: { amount: string }[];
  today: IsoDate;
}) {
  const total = sumCents(input.charges.map((c) => toCents(c.amount)));
  const paid = sumCents(input.confirmedPayments.map((p) => toCents(p.amount)));
  const ordered = [...input.charges].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let left: Cents = paid;
  let nextDue: IsoDate | null = null;
  for (const c of ordered) {
    const amount = toCents(c.amount);
    if (left >= amount) {
      left -= amount;
      continue;
    }
    nextDue = c.dueDate;
    break;
  }
  const balance = total - paid;
  const status: ReceiptStatus =
    balance <= 0 || nextDue === null
      ? "paid"
      : input.today > nextDue
        ? "overdue"
        : paid > 0
          ? "partial"
          : "pending";
  return {
    total: fromCents(total),
    paid: fromCents(paid),
    // Lo que falta. Negativo no: lo pagado de más se muestra como saldo a favor.
    balance: fromCents(Math.max(0, balance)),
    credit: fromCents(Math.max(0, -balance)),
    status,
    nextDue,
    daysLate: status === "overdue" && nextDue ? daysLate(nextDue, input.today) : 0,
  };
}

// "Vencido · faltan S/ 200" o "Pago parcial · faltan S/ 200" (siempre con texto, no solo color).
export function receiptLabel(
  status: ReceiptStatus,
  balance: string,
  paid: string,
  format: (a: string) => string | null,
) {
  if ((status === "overdue" || status === "partial") && toCents(paid) > 0) {
    return `${RECEIPT_STATUS_LABEL[status]} · faltan ${format(balance)}`;
  }
  return RECEIPT_STATUS_LABEL[status];
}

// Regla "comprobante de pago": si el monto no coincide con lo que falta del recibo, se avisa al revisarlo.
// Todo comprobante del residente queda en revisión hasta que el arrendador lo confirma (no hay pago en línea).
export const proofMismatch = (proofAmount: string, receiptBalance: string) =>
  toCents(proofAmount) !== toCents(receiptBalance);

// Regla "recibo único": un resumen mensual para el residente, agrupado por negocio (cada uno cobra con su RUC).
export function groupByBusiness<T extends { businessId: string }>(
  charges: T[],
): { businessId: string; charges: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const c of charges) groups.set(c.businessId, [...(groups.get(c.businessId) ?? []), c]);
  return [...groups].map(([businessId, list]) => ({ businessId, charges: list }));
}

export type ChargeConcept = "rent" | "deposit" | "damages";

export const CONCEPT_LABEL: Record<ChargeConcept, string> = {
  rent: "Renta",
  deposit: "Garantía",
  damages: "Daños que pasan la garantía",
};

// ¿Qué cargos de un recibo ya quedaron cubiertos? Los pagos confirmados se aplican en orden de vencimiento,
// igual que en receiptSummary. Sirve para saber si la garantía ya se pagó aunque el recibo siga con saldo.
export function coveredChargeIds(
  charges: { id: string; amount: string; dueDate: IsoDate }[],
  confirmedPayments: { amount: string }[],
): Set<string> {
  let left = sumCents(confirmedPayments.map((p) => toCents(p.amount)));
  const covered = new Set<string>();
  for (const c of [...charges].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    const amount = toCents(c.amount);
    if (left < amount) break;
    left -= amount;
    covered.add(c.id);
  }
  return covered;
}
