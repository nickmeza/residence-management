// Reglas de cobros (docs/reglas-de-negocio.md: recibo único, comprobante de pago). Funciones puras.
// BORRADOR de la Fase 5: los puntos marcados "PREGUNTA" esperan la decisión del dueño (ver ESTADO.md).
import type { IsoDate } from "@/server/contracts/dates";

import { toCents } from "./money";

// Mes de cobro: "AAAA-MM".
export type Period = string;

const lastDayOf = (period: Period) => {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

// Día de pago de un mes. 31 = fin de mes; en meses más cortos, el último día (lo mismo con 29 y 30 en febrero).
export function dueDate(period: Period, paymentDay: number): IsoDate {
  const day = Math.min(paymentDay, lastDayOf(period));
  return `${period}-${String(day).padStart(2, "0")}`;
}

export type ChargeStatus = "pending" | "paid" | "overdue";

// Pagado si ya se confirmó el pago; vencido desde el día siguiente al de pago; si no, pendiente.
export function chargeStatus(input: { dueDate: IsoDate; paid: boolean; today: IsoDate }): ChargeStatus {
  if (input.paid) return "paid";
  return input.today > input.dueDate ? "overdue" : "pending";
}

// Días de atraso para Morosidad (0 si no está vencido).
export function daysLate(due: IsoDate, today: IsoDate): number {
  if (today <= due) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000);
}

// Meses que cubre un contrato hasta `through` (incluido): un cargo de renta por mes.
// PREGUNTA: el primer y el último mes incompletos, ¿se cobran completos (como aquí) o proporcionales a los días?
export function rentPeriods(
  contract: { startDate: IsoDate; endDate: IsoDate | null },
  through: Period,
): Period[] {
  const periods: Period[] = [];
  let period = contract.startDate.slice(0, 7);
  const last =
    contract.endDate && contract.endDate.slice(0, 7) < through ? contract.endDate.slice(0, 7) : through;
  while (period <= last) {
    periods.push(period);
    const [y, m] = period.split("-").map(Number);
    period = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return periods;
}

// Regla "comprobante de pago": si el monto no coincide con el recibo, queda en revisión (no se confirma solo).
export const proofNeedsReview = (proofAmount: string, chargeAmount: string) =>
  toCents(proofAmount) !== toCents(chargeAmount);

// Regla "recibo único": un resumen mensual para el residente, agrupado por negocio (cada uno cobra con su RUC).
export function groupByBusiness<T extends { businessId: string }>(
  charges: T[],
): { businessId: string; charges: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const c of charges) groups.set(c.businessId, [...(groups.get(c.businessId) ?? []), c]);
  return [...groups].map(([businessId, list]) => ({ businessId, charges: list }));
}
