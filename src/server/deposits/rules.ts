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

// Lo que se pide si el negocio todavía no guardó su configuración (decisión del dueño, 2026-11-15): un departamento,
// 1 mes de renta; un cuarto, sin garantía. Si quiere otra cosa, la cambia en Configuración › Garantía.
export const DEFAULT_DEPOSIT_POLICY: Record<"room" | "apartment", DepositPolicy> = {
  room: { rule: "none", fixedAmount: null },
  apartment: { rule: "one_month", fixedAmount: null },
};

// La política del negocio para un tipo de unidad: la que guardó o, si no guardó nada, la de por defecto.
export function businessDepositPolicy(
  settings:
    | {
        roomRule: DepositRule;
        roomFixedAmount: string | null;
        apartmentRule: DepositRule;
        apartmentFixedAmount: string | null;
      }
    | null
    | undefined,
  type: "room" | "apartment",
): DepositPolicy {
  if (!settings) return DEFAULT_DEPOSIT_POLICY[type];
  return type === "room"
    ? { rule: settings.roomRule, fixedAmount: settings.roomFixedAmount }
    : { rule: settings.apartmentRule, fixedAmount: settings.apartmentFixedAmount };
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
// El plazo se cuenta en DÍAS HÁBILES, de lunes a viernes (decisión del dueño, 2026-11-15); los feriados vendrán
// después. Igual que la función entry_report_open de la base (migración 0017).
export function canReportEntry(input: { startDate: string; today: string; windowDays: number }) {
  if (input.today < input.startDate) return true;
  return input.today <= entryReportDeadline(input.startDate, input.windowDays);
}

// Último día para reportar: el N.º día hábil después del inicio (0 = solo el mismo día de inicio).
export function entryReportDeadline(startDate: string, windowDays: number): string {
  let date = startDate;
  for (let left = windowDays; left > 0;) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    date = d.toISOString().slice(0, 10);
    const weekday = d.getUTCDay(); // 0 = domingo, 6 = sábado
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return date;
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

// Garantía en otro mes o en cuotas (decisión del dueño, 2026-11-15): por defecto va entera en el recibo del mes en
// que empieza el contrato; el arrendador puede moverla a otro mes o partirla en cuotas mensuales (hasta 6). Cada
// cuota vence el mismo día del mes siguiente (o el último día, si ese mes es más corto). Los céntimos que no se
// pueden repartir parejo van en la última cuota.
export const MAX_DEPOSIT_INSTALLMENTS = 6;

export function depositInstallments(input: { amount: string; firstDue: string; count: number }) {
  const count = Math.max(1, Math.min(MAX_DEPOSIT_INSTALLMENTS, Math.floor(input.count)));
  const total = toCents(input.amount);
  const base = Math.floor(total / count);
  const [y, m, d] = input.firstDue.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const monthIndex = m - 1 + i;
    const year = y + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
    const amount = i === count - 1 ? total - base * (count - 1) : base;
    return { period: dueDate.slice(0, 7), dueDate, amount: fromCents(amount) };
  });
}

// ¿Ya se pagó la garantía? Sí, cuando TODAS sus cuotas (cargos "deposit" del contrato) están cubiertas por pagos
// confirmados. Sin cuotas (sin garantía), no.
export function depositChargesPaid(input: {
  contractId: string;
  charges: { id: string; contractId: string; concept: string }[];
  covered: Set<string>;
}) {
  const own = input.charges.filter((c) => c.contractId === input.contractId && c.concept === "deposit");
  return own.length > 0 && own.every((c) => input.covered.has(c.id));
}
