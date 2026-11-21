// Reportes (RP-01, RP-02, RP-04, RP-05). Funciones puras: reciben los datos ya leídos y devuelven las filas.
import type { IsoDate } from "@/server/contracts/dates";
import { fromCents, toCents } from "@/server/payments/money";
import { daysInPeriod, nextPeriod, type Period } from "@/server/payments/rules";

// Los últimos `count` meses hasta `current`, del más antiguo al más nuevo.
export function lastPeriods(current: Period, count: number): Period[] {
  return Array.from({ length: count }, (_, i) => nextPeriod(current, i - count + 1));
}

export type ReportUnit = {
  id: string;
  type: "apartment" | "room";
  parentId: string | null;
  rentalMode: "whole" | "by_room" | null;
  floorLabel: string;
};

export type ReportContract = {
  unitId: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  status: "draft" | "pending_signature" | "confirmed" | "cancelled";
};

// Lo que se alquila por sí mismo: cuarto suelto, departamento completo o cuarto de un departamento por cuartos.
export function rentableUnits(units: ReportUnit[]): ReportUnit[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  return units.filter((u) =>
    u.type === "apartment"
      ? u.rentalMode === "whole"
      : !u.parentId || byId.get(u.parentId)?.rentalMode === "by_room",
  );
}

const holds = (c: ReportContract) => c.status === "confirmed" || c.status === "pending_signature";

// Días de [from, to] (incluidos) en que el contrato ocupa la unidad.
function overlapDays(c: ReportContract, from: IsoDate, to: IsoDate): number {
  const start = c.startDate > from ? c.startDate : from;
  const end = c.endDate !== null && c.endDate < to ? c.endDate : to;
  if (end < start) return 0;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export type OccupancyRow = { label: string; rentable: number; occupied: number; percent: number };

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

// Ocupación de hoy por piso (RP-01): unidades que se alquilan y cuántas tienen a alguien viviendo.
export function occupancyByFloor(
  units: ReportUnit[],
  contracts: ReportContract[],
  today: IsoDate,
): OccupancyRow[] {
  const rentable = rentableUnits(units);
  const living = new Set(
    contracts.filter((c) => holds(c) && overlapDays(c, today, today) > 0).map((c) => c.unitId),
  );
  const labels = [...new Set(rentable.map((u) => u.floorLabel))];
  return labels.map((label) => {
    const here = rentable.filter((u) => u.floorLabel === label);
    const occupied = here.filter((u) => living.has(u.id)).length;
    return { label, rentable: here.length, occupied, percent: percent(occupied, here.length) };
  });
}

// Ocupación de cada mes (RP-05): días ocupados ÷ días posibles. El mes en curso cuenta hasta hoy. Supone que todas
// las unidades existían todo el periodo (no se guarda cuándo se creó cada una).
export function occupancyByMonth(
  units: ReportUnit[],
  contracts: ReportContract[],
  periods: Period[],
  today: IsoDate,
): { period: Period; percent: number }[] {
  const rentable = new Set(rentableUnits(units).map((u) => u.id));
  const own = contracts.filter((c) => holds(c) && rentable.has(c.unitId));
  return periods.map((period) => {
    const from = `${period}-01`;
    const last = `${period}-${String(daysInPeriod(period)).padStart(2, "0")}`;
    const to = last > today ? today : last;
    if (to < from) return { period, percent: 0 };
    const days = overlapDays({ unitId: "", startDate: from, endDate: to, status: "confirmed" }, from, to);
    const used = own.reduce((n, c) => n + overlapDays(c, from, to), 0);
    return { period, percent: Math.min(100, percent(used, days * rentable.size)) };
  });
}

export type FinanceRow = {
  period: Period;
  billed: string;
  collected: string;
  pending: string;
  maintenance: string;
  net: string;
};

// Ingresos de cada mes (RP-02): lo facturado (cargos del mes), lo cobrado (pagos confirmados de ese mes), lo que
// falta, lo gastado en mantenimiento (pedidos resueltos ese mes) y lo que queda.
export function financeByMonth(
  periods: Period[],
  charges: { period: Period; amount: string }[],
  payments: { period: Period; amount: string; status: string }[],
  costs: { period: Period; amount: string }[],
): FinanceRow[] {
  const sum = (rows: { period: Period; amount: string }[], p: Period) =>
    rows.filter((r) => r.period === p).reduce((t, r) => t + toCents(r.amount), 0);
  return periods.map((period) => {
    const billed = sum(charges, period);
    const collected = sum(
      payments.filter((x) => x.status === "confirmed"),
      period,
    );
    const maintenance = sum(costs, period);
    return {
      period,
      billed: fromCents(billed),
      collected: fromCents(collected),
      pending: fromCents(Math.max(0, billed - collected)),
      maintenance: fromCents(maintenance),
      net: fromCents(collected - maintenance),
    };
  });
}

// Pensión (RP-04): lo cobrado por mes (pagos confirmados según el día que pagó) y cuántos comensales tuvo.
export function pensionByMonth(
  periods: Period[],
  payments: { paidOn: IsoDate; amount: string; status: string }[],
  subscriptions: { residentId: string; startDate: IsoDate; endDate: IsoDate | null }[],
): { period: Period; collected: string; diners: number }[] {
  return periods.map((period) => {
    const from = `${period}-01`;
    const to = `${period}-${String(daysInPeriod(period)).padStart(2, "0")}`;
    const collected = payments
      .filter((p) => p.status === "confirmed" && p.paidOn.startsWith(period))
      .reduce((t, p) => t + toCents(p.amount), 0);
    const diners = new Set(
      subscriptions
        .filter((s) => s.startDate <= to && (s.endDate === null || s.endDate >= from))
        .map((s) => s.residentId),
    ).size;
    return { period, collected: fromCents(collected), diners };
  });
}

// CSV para Excel (RP-03): separado por comas, con comillas cuando hace falta.
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
