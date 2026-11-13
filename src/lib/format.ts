// Formatos para mostrar datos en la interfaz (español de Perú).

const soles = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// "1800" → "S/ 1,800". Vacío o inválido → null (la pantalla decide qué mostrar).
export function formatSoles(amount: string | number | null | undefined): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(n) ? `S/ ${soles.format(n)}` : null;
}

const shortDate = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// "2026-11-16" → "lun. 16 nov." (fechas guardadas sin hora: se leen en UTC para que no se corran un día).
export const formatShortDate = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

const longDateParts = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const dayMonth = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" });

// "2026-11-11" → "11 nov".
export const formatDayMonth = (date: string) =>
  dayMonth.format(new Date(`${date}T00:00:00Z`)).replace(".", "");

// "2026-11-11" → "miércoles 11 de noviembre".
export function formatLongDate(date: string): string {
  const p = Object.fromEntries(
    longDateParts.formatToParts(new Date(`${date}T00:00:00Z`)).map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.day} de ${p.month}`;
}
