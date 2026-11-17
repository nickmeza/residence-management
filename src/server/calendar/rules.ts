// Calendario general (DB-04). Funciones puras: el mes en semanas y los eventos de cada día. No guarda nada: los
// eventos salen de los contratos, los recibos, las tareas que se repiten y los pedidos de limpieza.
import { addDays, type IsoDate } from "@/server/contracts/dates";

export type CalendarKind = "check_in" | "check_out" | "receipt" | "maintenance" | "cleaning";

export const KIND_LABEL: Record<CalendarKind, string> = {
  check_in: "Ingreso",
  check_out: "Salida",
  receipt: "Cobro",
  maintenance: "Mantenimiento",
  cleaning: "Limpieza",
};

export type CalendarEvent = {
  key: string;
  date: IsoDate;
  kind: CalendarKind;
  label: string;
  href: string;
  // Atrasado: una tarea que ya tocaba o un recibo vencido sin pagar.
  late?: boolean;
};

// "2026-11" si es válido; si no, el mes de hoy.
export function parseMonth(value: string | undefined, today: IsoDate): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function monthRange(month: string): { from: IsoDate; to: IsoDate } {
  const from = `${month}-01`;
  return { from, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

// Semanas de lunes a domingo que cubren el mes (con días del mes anterior y del siguiente para completar).
export function monthWeeks(month: string): IsoDate[][] {
  const { from, to } = monthRange(month);
  const weekday = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  let day = addDays(from, -weekday);
  const weeks: IsoDate[][] = [];
  while (day <= to) {
    const week: IsoDate[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const ORDER: Record<CalendarKind, number> = {
  check_in: 0,
  check_out: 1,
  receipt: 2,
  maintenance: 3,
  cleaning: 4,
};

// Eventos agrupados por día, en un orden fijo (ingresos y salidas primero).
export function eventsByDay(events: CalendarEvent[]): Map<IsoDate, CalendarEvent[]> {
  const out = new Map<IsoDate, CalendarEvent[]>();
  for (const e of [...events].sort(
    (a, b) => ORDER[a.kind] - ORDER[b.kind] || a.label.localeCompare(b.label, "es"),
  )) {
    out.set(e.date, [...(out.get(e.date) ?? []), e]);
  }
  return out;
}
