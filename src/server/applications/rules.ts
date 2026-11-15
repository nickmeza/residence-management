// Postulantes (RS-03 a RS-05). Funciones puras.

export type ApplicationStatus = "new" | "waitlist" | "approved" | "rejected";

export const APPLICATION_STATUS_VALUES = ["new", "waitlist", "approved", "rejected"] as const;

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
