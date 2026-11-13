// Reglas de la pensión (Fase 6). Funciones puras: reciben datos y devuelven un resultado, sin base ni pantalla.
// Reglas de negocio: confirmación con hora límite (regla 12), días pausados no se cobran ni se solapan con días
// servidos, y el precio del plan no debería superar la suma de las comidas sueltas (es una advertencia).
import { daysBetween, type IsoDate } from "@/server/contracts/dates";
import { fromCents, toCents } from "@/server/payments/money";
import { daysInPeriod, type Period } from "@/server/payments/rules";

export type MealType = "breakfast" | "lunch" | "dinner";
export type ServiceMode = "dine_in" | "takeaway" | "delivery";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
};

export const SERVICE_MODE_LABEL: Record<ServiceMode, string> = {
  dine_in: "En el comedor",
  takeaway: "Para llevar",
  delivery: "Delivery",
};

// "07:30:00" → "07:30".
export const hhmm = (time: string) => time.slice(0, 5);

// Ahora en Lima como "AAAA-MM-DDTHH:MM" (se compara como texto con las horas límite).
const limaClock = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Lima",
});
export function limaNow(now: Date): string {
  const parts = Object.fromEntries(limaClock.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Hora límite para confirmar una comida: la hora límite del negocio ese día, o el inicio de la comida si es antes
// (no se puede confirmar un desayuno de las 7 hasta las 10). Igual que la función confirm_my_meal de la base.
export function mealDeadline(date: IsoDate, mealStart: string, confirmDeadline: string): string {
  const start = hhmm(mealStart);
  const limit = hhmm(confirmDeadline);
  return `${date}T${start < limit ? start : limit}`;
}

// ¿El comensal todavía puede confirmar o cambiar? Después de la hora límite solo la cocina.
export const confirmationOpen = (nowLima: string, deadline: string) => nowLima < deadline;

type DateRange = { fromDate: IsoDate; toDate: IsoDate };

export const isPaused = (date: IsoDate, pauses: DateRange[]) =>
  pauses.some((p) => p.fromDate <= date && date <= p.toDate);

export const coversDay = (sub: { startDate: IsoDate; endDate: IsoDate | null }, date: IsoDate) =>
  sub.startDate <= date && (sub.endDate === null || date <= sub.endDate);

// Una pausa nueva: fechas en orden, desde hoy, dentro de la afiliación, sin cruzarse con otra pausa ni con días
// servidos. null si sirve; si no, el motivo para mostrarlo.
export function pauseProblem(input: {
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  subscription: { startDate: IsoDate; endDate: IsoDate | null };
  pauses: DateRange[];
  servedDates: IsoDate[];
}): string | null {
  const { from, to, today, subscription: s } = input;
  if (to < from) return "La fecha de fin no puede ser antes que la de inicio.";
  if (from < today) return "La pausa no puede empezar en un día que ya pasó.";
  if (from < s.startDate || (s.endDate !== null && to > s.endDate)) {
    return "La pausa tiene que estar dentro de las fechas de la afiliación.";
  }
  if (input.servedDates.some((d) => from <= d && d <= to)) {
    return "Ya comió algún día de esas fechas: no se puede pausar.";
  }
  if (input.pauses.some((p) => p.fromDate <= to && p.toDate >= from)) {
    return "Ya hay una pausa en esas fechas.";
  }
  return null;
}

// Regla "Pensión": el precio del plan no debería superar la suma de sus comidas sueltas. Es una advertencia.
export function planPriceWarning(
  plan: { meals: MealType[]; dailyPrice: string },
  meals: { type: MealType; singlePrice: string }[],
): string | null {
  const prices = plan.meals.map((m) => meals.find((x) => x.type === m)?.singlePrice);
  if (prices.some((p) => p === undefined)) return null;
  const single = prices.reduce((t, p) => t + toCents(p!), 0);
  if (toCents(plan.dailyPrice) <= single) return null;
  return `El plan cuesta más que sus comidas sueltas (S/ ${fromCents(single)} al día).`;
}

// Estimado del mes (PN-16): días del mes que cubre la afiliación, menos los pausados, por el precio del día.
export function monthEstimate(input: {
  period: Period;
  dailyPrice: string;
  subscription: { startDate: IsoDate; endDate: IsoDate | null };
  pauses: DateRange[];
}) {
  const first = `${input.period}-01`;
  const last = `${input.period}-${String(daysInPeriod(input.period)).padStart(2, "0")}`;
  const from = input.subscription.startDate > first ? input.subscription.startDate : first;
  const end = input.subscription.endDate;
  const to = end !== null && end < last ? end : last;
  if (to < from) return { days: 0, pausedDays: 0, amount: "0.00" };
  let days = 0;
  let pausedDays = 0;
  for (let i = 0; i <= daysBetween(from, to); i++) {
    const day = addDays(from, i);
    if (isPaused(day, input.pauses)) pausedDays++;
    else days++;
  }
  return { days, pausedDays, amount: fromCents(toCents(input.dailyPrice) * days) };
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Lunes a domingo de la semana de una fecha (menú semanal).
export function weekOf(date: IsoDate): IsoDate[] {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const monday = addDays(date, -weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export type AttendanceState = "confirmed" | "declined" | "pending" | "paused";

// Cómo está cada comensal para una comida de un día (panel de cocina, PN-06).
export function attendanceState(input: {
  paused: boolean;
  attendance: { confirmed: boolean } | null;
}): AttendanceState {
  if (input.paused) return "paused";
  if (!input.attendance) return "pending";
  return input.attendance.confirmed ? "confirmed" : "declined";
}

export const ATTENDANCE_LABEL: Record<AttendanceState, string> = {
  confirmed: "Viene",
  declined: "No viene",
  pending: "Sin responder",
  paused: "Pausado",
};

// Porciones a preparar: solo los que confirmaron (sin respuesta = no se cocina, para no desperdiciar).
export function kitchenCounts(states: { state: AttendanceState; served: boolean }[]) {
  return {
    portions: states.filter((s) => s.state === "confirmed").length,
    declined: states.filter((s) => s.state === "declined").length,
    pending: states.filter((s) => s.state === "pending").length,
    served: states.filter((s) => s.served).length,
  };
}
