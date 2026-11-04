// Saludo según la hora en Lima (CLAUDE.md: zona horaria America/Lima), como "Buenos días, Carlos" del prototipo.

const limaHour = new Intl.DateTimeFormat("es-PE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "America/Lima",
});

export function greetingFor(date: Date): "Buenos días" | "Buenas tardes" | "Buenas noches" {
  const hour = Number(limaHour.format(date));
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Nombre para el saludo: nombre y primer apellido, es decir, las dos primeras palabras.
// "Nick Meza Ramos" → "Nick Meza". Lo que sigue después del segundo espacio no se muestra.
export const greetingName = (fullName: string) => fullName.trim().split(/\s+/).slice(0, 2).join(" ");

// Iniciales para el avatar: "Carlos Ramos" → "CR".
export function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
