// Dinero en céntimos (enteros) para no perder decimales al sumar: 0.1 + 0.2 no da 0.3 en JavaScript.
// La base guarda numeric(10,2) y Drizzle lo devuelve como texto ("500.00"). Funciones puras.

export type Cents = number;

// "500" | "500.5" | "500.50" → 50050. Texto inválido → error (es un dato de la base, no de un formulario).
export function toCents(amount: string | number): Cents {
  const text = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error(`Monto inválido: ${text}`);
  const [whole, decimals = ""] = text.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return text.startsWith("-") ? -cents : cents;
}

// 50050 → "500.50", el formato que espera la columna numeric.
export function fromCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const sumCents = (values: Cents[]) => values.reduce((total, v) => total + v, 0);
