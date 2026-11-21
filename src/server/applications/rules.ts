// Postulantes (RS-03 a RS-05). Funciones puras.

import { toCents } from "@/server/payments/money";

export type ApplicationStatus = "new" | "waitlist" | "approved" | "rejected";

export const APPLICATION_STATUS_VALUES = ["new", "waitlist", "approved", "rejected"] as const;

// Cómo se escribe cada estado en la dirección (?filtro=nuevas).
export const APPLICATION_STATUS_SLUGS: Record<ApplicationStatus, string> = {
  new: "nuevas",
  waitlist: "lista-de-espera",
  approved: "aprobadas",
  rejected: "rechazadas",
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: "Nueva",
  waitlist: "Lista de espera",
  approved: "Aprobada",
  rejected: "Rechazada",
};

// Solo los dígitos, sin el +51 de Perú: "+51 987 654 321" y "987654321" son el mismo celular.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("51") ? digits.slice(2) : digits;
}

// Contra el spam y el doble clic: el mismo celular no postula dos veces al mismo negocio en 24 horas.
export function isRepeated(
  previous: { phone: string; createdAt: Date }[],
  phone: string,
  now: Date,
): boolean {
  const mine = normalizePhone(phone);
  return previous.some(
    (p) => normalizePhone(p.phone) === mine && now.getTime() - p.createdAt.getTime() < 24 * 3_600_000,
  );
}

// Qué se puede hacer con una postulación. Aprobada ya tiene su ficha de residente: no vuelve atrás.
export function applicationMoves(status: ApplicationStatus): ApplicationStatus[] {
  if (status === "approved") return [];
  if (status === "rejected") return ["waitlist"];
  return (["waitlist", "approved", "rejected"] as const).filter((s) => s !== status);
}

// Unidad que se puede ofrecer: se alquila por sí misma, está libre hoy y tiene precio.
export type SuggestionCandidate = {
  id: string;
  type: "room" | "apartment";
  label: string;
  monthlyPrice: string;
};

export type UnitSuggestion = SuggestionCandidate & {
  // Precio − presupuesto, en céntimos (negativo: cuesta menos de lo que puede pagar). null si no dio presupuesto.
  differenceCents: number | null;
};

// Cuarto sugerido para un postulante: del tipo que busca ("" = cualquiera), el de precio más cercano a su presupuesto
// (si empatan, el más barato); sin presupuesto, el más barato. null si no hay ninguno libre de ese tipo.
export function suggestUnit(
  candidates: SuggestionCandidate[],
  want: { unitType: "room" | "apartment" | null; budget: string | null },
): UnitSuggestion | null {
  const budget = want.budget ? toCents(want.budget) : null;
  const pool = candidates.filter((c) => !want.unitType || c.type === want.unitType);
  const ranked = pool
    .map((c) => {
      const price = toCents(c.monthlyPrice);
      return { c, price, distance: budget === null ? price : Math.abs(price - budget) };
    })
    .sort((a, b) => a.distance - b.distance || a.price - b.price);
  const best = ranked[0];
  if (!best) return null;
  return { ...best.c, differenceCents: budget === null ? null : best.price - budget };
}
