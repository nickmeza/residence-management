// Reglas de la garantía (CLAUDE.md, reglas 5 a 9; docs/reglas-de-negocio.md). Funciones puras.
// BORRADOR de la Fase 5: los puntos marcados "PREGUNTA" esperan la decisión del dueño (ver ESTADO.md).
import { fromCents, sumCents, toCents } from "@/server/payments/money";

// Regla 5: la política es del arrendador. Sin garantía, 1 mes, 2 meses o un monto fijo.
export type DepositPolicy =
  { kind: "none" } | { kind: "one_month" } | { kind: "two_months" } | { kind: "fixed"; amount: string };

// Monto de la garantía de un contrato: la excepción de la unidad, si hay, gana sobre la política de su tipo
// (cuarto o departamento). Se calcula con la renta del contrato.
export function depositAmount(input: {
  policy: DepositPolicy;
  unitException: DepositPolicy | null;
  monthlyRent: string;
}): string {
  const rule = input.unitException ?? input.policy;
  switch (rule.kind) {
    case "none":
      return "0.00";
    case "one_month":
      return fromCents(toCents(input.monthlyRent));
    case "two_months":
      return fromCents(toCents(input.monthlyRent) * 2);
    case "fixed":
      return fromCents(toCents(rule.amount));
  }
}

export type DiscountStatus = "active" | "disputed" | "adjusted" | "withdrawn";

// Regla 6: monto a devolver = garantía − descuentos vigentes, nunca negativo.
// Cuentan los vigentes y los ajustados (el ajustado ya tiene su monto corregido); el retirado no cuenta.
// Regla 7: mientras haya un descuento disputado, la devolución no se paga.
// PREGUNTA: ¿el monto disputado se resta mientras tanto (como aquí) o se muestra aparte hasta resolverlo?
export function settlement(input: {
  deposit: string;
  discounts: { amount: string; status: DiscountStatus }[];
}) {
  const counted = input.discounts.filter((d) => d.status !== "withdrawn");
  const total = sumCents(counted.map((d) => toCents(d.amount)));
  const refund = Math.max(0, toCents(input.deposit) - total);
  return {
    totalDiscounts: fromCents(total),
    refund: fromCents(refund),
    // Los descuentos pueden pasar la garantía; el residente no paga la diferencia aquí.
    discountsExceedDeposit: total > toCents(input.deposit),
    canPay: !input.discounts.some((d) => d.status === "disputed"),
  };
}

export type InspectionArea = "walls" | "door" | "window" | "furniture" | "keys" | "cleaning" | "other";
export type Condition = "good" | "minor_detail" | "minor_damage" | "major_damage";

// Regla 8: la revisión de ingreso es la base. Lo que ya estaba mal al ingresar no se descuenta al salir.
// PREGUNTA: ¿se bloquea todo el rubro (como aquí) o solo si al salir está igual o mejor que al ingresar?
export function canDiscount(area: InspectionArea, entry: { area: InspectionArea; condition: Condition }[]) {
  const atEntry = entry.find((e) => e.area === area);
  return !atEntry || atEntry.condition === "good";
}
