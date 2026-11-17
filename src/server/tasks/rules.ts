// Tareas que se repiten (MT-04 y limpieza de áreas comunes). Funciones puras: fechas siguientes y estado.
import { addDays, type IsoDate } from "@/server/contracts/dates";

export type TaskKind = "maintenance" | "cleaning";
export type TaskPeriod = "day" | "week" | "month";

export const KIND_VALUES = ["maintenance", "cleaning"] as const;
export const PERIOD_VALUES = ["day", "week", "month"] as const;

export const KIND_LABEL: Record<TaskKind, string> = { maintenance: "Mantenimiento", cleaning: "Limpieza" };

// Con cuánta anticipación una tarea aparece en Pendientes (decisión, 2026-11-17: 7 días).
export const DUE_SOON_DAYS = 7;

// "Cada semana", "Cada 2 semanas", "Cada 6 meses".
export function everyLabel(every: number, period: TaskPeriod): string {
  const one = { day: "día", week: "semana", month: "mes" }[period];
  const many = { day: "días", week: "semanas", month: "meses" }[period];
  return every === 1 ? `Cada ${one}` : `Cada ${every} ${many}`;
}

// Suma meses sin pasarse del último día: 31 de enero + 1 mes = 28 (o 29) de febrero.
function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

// La fecha que sigue a `date` según la frecuencia.
export function step(date: IsoDate, every: number, period: TaskPeriod): IsoDate {
  if (period === "day") return addDays(date, every);
  if (period === "week") return addDays(date, every * 7);
  return addMonths(date, every);
}

// Al marcarla hecha: la próxima fecha mantiene el ritmo (si tocaba el lunes, sigue tocando los lunes) y queda
// después del día en que se hizo. Si se hizo con mucho atraso, se saltan las fechas que ya pasaron.
export function nextDueAfter(due: IsoDate, every: number, period: TaskPeriod, doneOn: IsoDate): IsoDate {
  let next = step(due, every, period);
  while (next <= doneOn) next = step(next, every, period);
  return next;
}

export type TaskState = "overdue" | "today" | "soon" | "later";

export function taskState(nextDue: IsoDate, today: IsoDate): TaskState {
  if (nextDue < today) return "overdue";
  if (nextDue === today) return "today";
  if (nextDue <= addDays(today, DUE_SOON_DAYS)) return "soon";
  return "later";
}

export const STATE_LABEL: Record<TaskState, string> = {
  overdue: "Atrasada",
  today: "Hoy",
  soon: "Esta semana",
  later: "Más adelante",
};

// Las fechas en que toca una tarea entre `from` y `to` (para el calendario), desde su próxima fecha.
export function occurrencesBetween(
  task: { nextDue: IsoDate; every: number; period: TaskPeriod },
  from: IsoDate,
  to: IsoDate,
  max = 62,
): IsoDate[] {
  const out: IsoDate[] = [];
  let d = task.nextDue;
  while (d <= to && out.length < max) {
    if (d >= from) out.push(d);
    d = step(d, task.every, task.period);
  }
  return out;
}
