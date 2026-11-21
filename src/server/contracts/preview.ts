// Resumen de un contrato mientras se arma (página Nuevo contrato): cuánto es la garantía y cómo será el primer
// recibo. Usa las mismas reglas que Cobros al confirmarlo (rentCharges y la garantía en el mes en que se cobra), así
// lo que se ve antes de crearlo coincide con lo que después aparece en el recibo. Función pura.
import { depositAmount, effectivePolicy, type DepositPolicy } from "@/server/deposits/rules";
import { fromCents, toCents } from "@/server/payments/money";
import { periodOf, rentCharges } from "@/server/payments/rules";

import type { IsoDate } from "./dates";

export type ContractPreviewInput = {
  startDate: string;
  endDate: string;
  monthlyRent: string;
  paymentDay: string;
  prorate: boolean;
  // Lo que le toca a la unidad sin decidir nada para la persona (null: todavía no eligió la unidad).
  unitDeposit: DepositPolicy | null;
  // "" = la de siempre; si no, lo que se decide para esta persona.
  depositRule: "" | DepositPolicy["rule"];
  depositFixedAmount: string;
  depositDueDate: string;
  today: IsoDate;
};

export type ContractPreview = {
  deposit: { rule: DepositPolicy["rule"]; amount: string; dueDate: IsoDate } | null;
  firstReceipt: {
    period: string;
    dueDate: IsoDate;
    rent: string;
    // Días que se cobran si el primer mes está incompleto y la renta se prorratea (null: mes completo).
    days: number | null;
    deposit: string | null;
    total: string;
  } | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim()) && Number(v) > 0;

// Sin unidad, fechas o renta válidas, lo que falta queda en null (el resumen dice "Elige…").
export function contractPreview(input: ContractPreviewInput): ContractPreview {
  const rentOk = isAmount(input.monthlyRent);
  const startOk = ISO.test(input.startDate);
  const endOk = input.endDate === "" || (ISO.test(input.endDate) && input.endDate >= input.startDate);
  const day = Number(input.paymentDay);

  let deposit: ContractPreview["deposit"] = null;
  if (input.unitDeposit && rentOk && startOk) {
    const policy = effectivePolicy({
      business: null,
      unit: input.unitDeposit,
      contract: input.depositRule
        ? { rule: input.depositRule, fixedAmount: input.depositFixedAmount || null }
        : null,
    });
    const fixedMissing = policy.rule === "fixed" && !isAmount(policy.fixedAmount ?? "");
    if (!fixedMissing) {
      deposit = {
        rule: policy.rule,
        amount: depositAmount(policy, input.monthlyRent),
        dueDate: ISO.test(input.depositDueDate) ? input.depositDueDate : input.startDate,
      };
    }
  }

  if (!rentOk || !startOk || !endOk || !(day >= 1 && day <= 31)) return { deposit, firstReceipt: null };
  const [first] = rentCharges({
    startDate: input.startDate,
    endDate: input.endDate || null,
    monthlyRent: input.monthlyRent,
    paymentDay: day,
    prorate: input.prorate,
    today: input.today,
  });
  if (!first) return { deposit, firstReceipt: null };
  // La garantía va en el recibo del mes en que se cobra; si es este, se suma.
  const depositHere =
    deposit && Number(deposit.amount) > 0 && periodOf(deposit.dueDate) === first.period
      ? deposit.amount
      : null;
  return {
    deposit,
    firstReceipt: {
      period: first.period,
      dueDate: first.dueDate,
      rent: first.amount,
      days: first.days,
      deposit: depositHere,
      total: fromCents(toCents(first.amount) + (depositHere ? toCents(depositHere) : 0)),
    },
  };
}
