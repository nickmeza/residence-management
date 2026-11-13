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

// Por defecto se cocina para todos los afiliados; el comensal cancela hasta la hora de cancelación del DÍA ANTERIOR
// (decisión del dueño, 2026-11-13). Igual que la función cancel_my_meal de la base.
export const cancelDeadline = (date: IsoDate, cancelTime: string) =>
  `${addDays(date, -1)}T${hhmm(cancelTime)}`;

// ¿El comensal todavía puede cancelar o volver a pedir? Después de la hora límite solo la cocina.
export const cancellationOpen = (nowLima: string, deadline: string) => nowLima < deadline;

type DateRange = { fromDate: IsoDate; toDate: IsoDate };

export const isPaused = (date: IsoDate, pauses: DateRange[]) =>
  pauses.some((p) => p.fromDate <= date && date <= p.toDate);

// Días de atención (decisión del dueño, 2026-11-13): 1 = lunes … 7 = domingo. Los días que la pensión no cocina
// no se cocinan, no se cancelan y no se cobran.
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};
export const isoWeekday = (date: IsoDate) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
export const isServiceDay = (date: IsoDate, serviceDays: number[]) => serviceDays.includes(isoWeekday(date));

// El día de servicio más cercano antes (step = -1) o después (step = 1) de `date`; los días sin servicio no se
// muestran (decisión del dueño, 2026-11-13). Sin días de servicio, el día de al lado.
export function nearestServiceDay(date: IsoDate, step: 1 | -1, serviceDays: number[]): IsoDate {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i * step);
    if (isServiceDay(d, serviceDays)) return d;
  }
  return addDays(date, step);
}

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

export type BillingCycle = "daily" | "weekly" | "monthly";

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
};

// Lo que cuesta un tramo de días de una afiliación (cobro por adelantado, decisión del dueño):
// - días sin atención (la pensión no cocina) y días pausados: no se cobran;
// - una comida cancelada a tiempo no se cobra: vale el precio del día dividido entre las comidas del plan;
// - una cancelación fuera de plazo (la hizo la cocina después de la hora límite) sí se cobra.
export function rangeCost(input: {
  from: IsoDate;
  to: IsoDate;
  dailyPrice: string;
  mealsPerDay: number;
  subscription: { startDate: IsoDate; endDate: IsoDate | null };
  pauses: DateRange[];
  cancelledOnTime: IsoDate[]; // una fecha por cada comida cancelada a tiempo
  serviceDays?: number[]; // sin dato = cocina todos los días
}) {
  const s = input.subscription;
  const serviceDays = input.serviceDays ?? ALL_DAYS;
  const from = input.from > s.startDate ? input.from : s.startDate;
  const to = s.endDate !== null && s.endDate < input.to ? s.endDate : input.to;
  const perDay = toCents(input.dailyPrice);
  const perMeal = Math.round(perDay / Math.max(1, input.mealsPerDay));
  let days = 0;
  let cents = 0;
  for (let i = 0; from <= to && i <= daysBetween(from, to); i++) {
    const day = addDays(from, i);
    if (!isServiceDay(day, serviceDays) || isPaused(day, input.pauses)) continue;
    days++;
    const cancelled = input.cancelledOnTime.filter((d) => d === day).length;
    cents += Math.max(0, perDay - perMeal * cancelled);
  }
  return { days, amount: fromCents(cents) };
}

// Hasta qué día cubre el próximo pago, según la frecuencia: un día, una semana o hasta el mismo día del mes siguiente.
export function nextCoverage(from: IsoDate, cycle: BillingCycle): { from: IsoDate; to: IsoDate } {
  if (cycle === "daily") return { from, to: from };
  if (cycle === "weekly") return { from, to: addDays(from, 6) };
  const [y, m, d] = from.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, Math.min(d, daysInPeriod(nextPeriodOf(y, m)))));
  return { from, to: addDays(nextMonth.toISOString().slice(0, 10), -1) };
}

const nextPeriodOf = (year: number, month: number): Period =>
  month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

// Estado de cuenta de un comensal (PN-16): hasta qué día pagó y si tiene saldo a favor o deuda a hoy.
// Saldo = lo pagado − lo que cuestan los días desde el inicio hasta lo último pagado (o hasta hoy si debe).
export function pensionAccount(input: {
  today: IsoDate;
  dailyPrice: string;
  mealsPerDay: number;
  cycle: BillingCycle;
  subscription: { startDate: IsoDate; endDate: IsoDate | null };
  pauses: DateRange[];
  cancelledOnTime: IsoDate[];
  serviceDays?: number[];
  payments: { amount: string; coversTo: IsoDate }[];
}) {
  const start = input.subscription.startDate;
  const costTo = (to: IsoDate) => toCents(rangeCost({ ...input, from: start, to }).amount);
  const paid = input.payments.reduce((t, p) => t + toCents(p.amount), 0);
  // Hasta dónde dicen cubrir los pagos (el último día que cubre alguno).
  const declaredUntil = input.payments.reduce<IsoDate | null>(
    (max, p) => (max === null || p.coversTo > max ? p.coversTo : max),
    null,
  );
  // Pagos por partes (decisión del dueño, 2026-11-13): "pagado hasta" solo llega hasta el último día que el dinero
  // alcanza a cubrir, día por día desde el inicio, sin pasar de lo declarado.
  let paidUntil: IsoDate | null = null;
  if (declaredUntil !== null) {
    let acc = 0;
    for (let d = start; d <= declaredUntil; d = addDays(d, 1)) {
      acc += toCents(rangeCost({ ...input, from: d, to: d }).amount);
      if (acc > paid) break;
      paidUntil = d;
    }
  }
  // Un tramo pagado a medias: lo que falta para completarlo.
  const partial =
    declaredUntil !== null && paidUntil !== declaredUntil
      ? {
          from: paidUntil === null ? start : addDays(paidUntil, 1),
          to: declaredUntil,
          missing: fromCents(Math.max(0, costTo(declaredUntil) - paid)),
        }
      : null;
  const through = declaredUntil !== null && declaredUntil > input.today ? declaredUntil : input.today;
  const balance = paid - costTo(through);
  // El próximo pago: completar el tramo a medias o, si no hay, el día después de lo pagado (o el inicio) hasta por
  // lo menos hoy más un tramo.
  const from = paidUntil === null ? start : addDays(paidUntil, 1);
  const to = nextCoverage(from > input.today ? from : input.today, input.cycle).to;
  const nextCost = toCents(rangeCost({ ...input, from, to }).amount);
  // Saldo a favor de lo ya pagado (cancelaciones a tiempo dentro de lo pagado, o pagó de más): se descuenta.
  const credit = paidUntil === null ? 0 : paid - costTo(paidUntil);
  return {
    paidUntil,
    // Positivo = saldo a favor (cancelaciones a tiempo, pagó de más); negativo = debe a hoy.
    balance: fromCents(balance),
    upToDate: paidUntil !== null && paidUntil >= input.today && balance >= 0,
    partial,
    // Sugerido para el próximo pago: lo que falta del tramo a medias, o el siguiente tramo menos el saldo a favor.
    next: partial
      ? { from: partial.from, to: partial.to, amount: partial.missing }
      : { from, to, amount: fromCents(Math.max(0, nextCost - credit)) },
  };
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

export type AttendanceState = "coming" | "cancelled" | "paused";

// Cómo está cada comensal para una comida de un día (panel de cocina, PN-06). Sin fila = viene.
export function attendanceState(input: {
  paused: boolean;
  attendance: { cancelled: boolean } | null;
}): AttendanceState {
  if (input.paused) return "paused";
  return input.attendance?.cancelled ? "cancelled" : "coming";
}

export const ATTENDANCE_LABEL: Record<AttendanceState, string> = {
  coming: "Viene",
  cancelled: "Canceló",
  paused: "Pausado",
};

// Porciones a preparar: todos los afiliados menos los que cancelaron o pausaron.
export function kitchenCounts(states: { state: AttendanceState; served: boolean }[]) {
  return {
    portions: states.filter((s) => s.state === "coming").length,
    cancelled: states.filter((s) => s.state === "cancelled").length,
    served: states.filter((s) => s.served).length,
  };
}

// Un comensal no puede tener dos afiliaciones a la vez: se le cocinaría y cobraría doble. Sin fecha de fin = abierta.
export function overlapsSubscription(
  next: { startDate: IsoDate; endDate: IsoDate | null },
  others: { startDate: IsoDate; endDate: IsoDate | null }[],
): boolean {
  const end = (d: IsoDate | null) => d ?? "9999-12-31";
  return others.some((o) => o.startDate <= end(next.endDate) && end(o.endDate) >= next.startDate);
}

// La cocina marca "comió" o cancela una comida (aunque haya pasado la hora límite): el comensal tiene que tener esa
// comida ese día en su plan y no estar en pausa. null si se puede; si no, el motivo.
export function kitchenProblem(input: {
  date: IsoDate;
  meal: MealType;
  subscription: { startDate: IsoDate; endDate: IsoDate | null; planMeals: MealType[] } | null;
  pauses: DateRange[];
}): string | null {
  const s = input.subscription;
  if (!s || !coversDay(s, input.date) || !s.planMeals.includes(input.meal)) {
    return "Ese día su plan no incluye esa comida.";
  }
  if (isPaused(input.date, input.pauses)) return "Ese día tiene la pensión en pausa.";
  return null;
}

// Una pausa que todavía no empezó se puede quitar; la que ya empezó, no (esos días ya no se cocinaron).
export const pauseRemovable = (pause: { fromDate: IsoDate }, today: IsoDate) => pause.fromDate > today;
