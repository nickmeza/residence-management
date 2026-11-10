// Fechas de contratos. Se guardan como "AAAA-MM-DD" (columna date): sin hora ni zona horaria,
// así que se comparan como texto y se cuentan días en UTC para que nada se corra un día.

export type IsoDate = string;

// Hoy en Lima (CLAUDE.md: zona horaria America/Lima). "en-CA" da el formato AAAA-MM-DD.
const limaDate = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Lima",
});
export const limaToday = (now: Date): IsoDate => limaDate.format(now);

const toUtc = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`);

// Días de `from` a `to`: 2026-03-01 → 2026-03-31 = 30.
export const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);

// ¿Se cruzan dos periodos? Los dos días de cada extremo cuentan. Sin fecha de fin = sin límite.
export function periodsOverlap(
  a: { startDate: IsoDate; endDate: IsoDate | null },
  b: { startDate: IsoDate; endDate: IsoDate | null },
): boolean {
  const aEndsBeforeB = a.endDate !== null && a.endDate < b.startDate;
  const bEndsBeforeA = b.endDate !== null && b.endDate < a.startDate;
  return !aEndsBeforeB && !bEndsBeforeA;
}

// "2026-03-01" → "1 de marzo de 2026", para plantillas y pantallas.
const longDate = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const formatLongDate = (date: IsoDate) => longDate.format(new Date(toUtc(date)));

// Cuánto falta para el fin, como en la lista de residentes: "En 5 días", "En 2 meses", "Venció".
export function endsInLabel(endDate: IsoDate | null, today: IsoDate): string {
  if (endDate === null) return "Sin fecha de fin";
  const days = daysBetween(today, endDate);
  if (days < 0) return "Venció";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days < 60) return `En ${days} días`;
  return `En ${Math.round(days / 30)} meses`;
}

// "2026-03-01" + 1 = "2026-03-02". Con -1 da el día anterior.
export const addDays = (date: IsoDate, days: number): IsoDate =>
  new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
