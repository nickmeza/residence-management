// Reglas de la garantía (CLAUDE.md, reglas 5 a 9; docs/reglas-de-negocio.md). Funciones puras.
// Decisiones del dueño (2026-11-12): ver el registro de decisiones del README.
import { fromCents, sumCents, toCents } from "@/server/payments/money";

// Regla 5: la política es del arrendador. Sin garantía, 1 mes, 2 meses o un monto fijo.
export type DepositRule = "none" | "one_month" | "two_months" | "fixed";
export type DepositPolicy = { rule: DepositRule; fixedAmount: string | null };

export const DEPOSIT_RULE_LABEL: Record<DepositRule, string> = {
  none: "Sin garantía",
  one_month: "1 mes de renta",
  two_months: "2 meses de renta",
  fixed: "Monto fijo",
};

// Qué política vale para un contrato. Igual que los documentos: la configuración del negocio (por tipo de unidad)
// es la base, la excepción de la unidad gana sobre ella y lo que se decida para esta persona gana sobre todo
// (por ejemplo, un familiar al que no se le pide garantía). null = no hay nada definido en ese nivel.
export function effectivePolicy(input: {
  business: DepositPolicy | null;
  unit: DepositPolicy | null;
  contract: DepositPolicy | null;
}): DepositPolicy {
  return input.contract ?? input.unit ?? input.business ?? { rule: "none", fixedAmount: null };
}

// Monto de la garantía con la renta del contrato.
export function depositAmount(policy: DepositPolicy, monthlyRent: string): string {
  switch (policy.rule) {
    case "none":
      return "0.00";
    case "one_month":
      return fromCents(toCents(monthlyRent));
    case "two_months":
      return fromCents(toCents(monthlyRent) * 2);
    case "fixed":
      return fromCents(toCents(policy.fixedAmount ?? "0"));
  }
}

// "1 mes de renta", "Monto fijo de S/ 300"… para mostrar de dónde sale el monto.
export function policyLabel(policy: DepositPolicy, formatMoney: (amount: string) => string | null) {
  if (policy.rule === "fixed" && policy.fixedAmount)
    return `Monto fijo de ${formatMoney(policy.fixedAmount)}`;
  return DEPOSIT_RULE_LABEL[policy.rule];
}

export type DiscountStatus = "active" | "disputed" | "adjusted" | "withdrawn";

// Reglas 6 y 7: monto a devolver = garantía − descuentos vigentes, nunca negativo, y lo disputado no se paga.
// Decisión del dueño: el descuento disputado no se resta ni se paga; se muestra aparte hasta que el arrendador lo
// ajuste o lo retire. Mientras tanto se puede devolver lo que nadie discute (garantía − vigentes − disputados).
export function settlement(input: {
  deposit: string;
  discounts: { amount: string; status: DiscountStatus }[];
  refunded?: string;
}) {
  const deposit = toCents(input.deposit);
  const sumOf = (statuses: DiscountStatus[]) =>
    sumCents(input.discounts.filter((d) => statuses.includes(d.status)).map((d) => toCents(d.amount)));
  // Vigentes y ajustados cuentan (el ajustado ya tiene su monto corregido); el retirado no.
  const counted = sumOf(["active", "adjusted"]);
  const disputed = sumOf(["disputed"]);
  const refunded = toCents(input.refunded ?? "0");
  const refund = Math.max(0, deposit - counted);
  const undisputed = Math.max(0, deposit - counted - disputed);
  return {
    totalDiscounts: fromCents(counted),
    disputed: fromCents(disputed),
    hasDisputes: disputed > 0 || input.discounts.some((d) => d.status === "disputed"),
    // Lo que se devuelve si los disputados se retiran: garantía − vigentes.
    refund: fromCents(refund),
    // Lo que ya se puede pagar hoy, menos lo que ya se devolvió.
    payableNow: fromCents(Math.max(0, undisputed - refunded)),
    // Pregunta 9: lo que los descuentos pasan de la garantía. Se cobra como cargo o el arrendador lo perdona.
    // Solo cuenta lo vigente: lo disputado no se cobra hasta resolverse.
    excess: fromCents(Math.max(0, counted - deposit)),
    // Todo devuelto y sin disputas: la liquidación se puede cerrar.
    fullyRefunded: disputed === 0 && refunded >= refund,
  };
}

export type InspectionArea = "walls" | "door" | "window" | "furniture" | "keys" | "cleaning" | "other";

export const AREA_LABEL: Record<InspectionArea, string> = {
  walls: "Paredes",
  door: "Puerta y cerradura",
  window: "Ventana",
  furniture: "Muebles",
  keys: "Llaves",
  cleaning: "Limpieza",
  other: "Otro",
};

export const INSPECTION_AREAS = Object.keys(AREA_LABEL) as InspectionArea[];

// Regla 8: lo que el residente reportó al ingresar es la base. Decisión del dueño: en ese rubro solo se descuenta
// si al salir está peor que al entrar, y el arrendador lo justifica con una foto (el residente puede disputarlo).
// "Otro" no se compara con nada: cada reporte de "otro" es distinto.
export type DiscountProblem = "needs_worse_than_entry" | "needs_photo";

export function discountProblems(input: {
  area: InspectionArea;
  worseThanEntry: boolean;
  hasPhoto: boolean;
  entryAreas: readonly InspectionArea[];
}): DiscountProblem[] {
  if (input.area === "other" || !input.entryAreas.includes(input.area)) return [];
  const problems: DiscountProblem[] = [];
  if (!input.worseThanEntry) problems.push("needs_worse_than_entry");
  if (!input.hasPhoto) problems.push("needs_photo");
  return problems;
}

// Pregunta 10: el residente reporta lo que ya estaba mal (con foto) cuando lo nota, sin revisar todo el cuarto.
// Solo durante los primeros días del contrato: reportarlo al salir no serviría como base.
export function canReportEntry(input: { startDate: string; today: string; windowDays: number }) {
  if (input.today < input.startDate) return true;
  const days = Math.round(
    (Date.parse(`${input.today}T00:00:00Z`) - Date.parse(`${input.startDate}T00:00:00Z`)) / 86_400_000,
  );
  return days <= input.windowDays;
}

export type DepositStatus = "none" | "held" | "settling" | "returned";

// Cómo se ve una garantía. "Por cobrar": la garantía existe pero su cargo todavía no se pagó.
export type DepositPhase = "none" | "unpaid" | "held" | "settling" | "disputed" | "returned";

export const DEPOSIT_PHASE_LABEL: Record<DepositPhase, string> = {
  none: "Sin garantía",
  unpaid: "Por cobrar",
  held: "Retenida",
  settling: "En liquidación",
  disputed: "En disputa",
  returned: "Devuelta",
};

export function depositPhase(input: {
  status: DepositStatus;
  chargePaid: boolean;
  hasDisputes: boolean;
}): DepositPhase {
  if (input.status === "none") return "none";
  if (input.status === "returned") return "returned";
  if (input.status === "settling") return input.hasDisputes ? "disputed" : "settling";
  return input.chargePaid ? "held" : "unpaid";
}
