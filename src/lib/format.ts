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
