import { z } from "zod";

import { INSPECTION_AREAS } from "@/server/deposits/rules";
import { PAYMENT_METHODS, type PaymentMethod } from "@/server/onboarding/schema";

// Formularios de cobros y garantía. Los campos llegan como texto; vacío = sin dato.

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
};

export { PAYMENT_METHODS };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.");
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elige el mes.");
export const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Escribe un monto, por ejemplo 650 o 650.50.");
const positiveMoney = money.refine((v) => Number(v) > 0, "Tiene que ser mayor que cero.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Es demasiado largo.")
    .transform((v) => v || null);

const RULES = ["none", "one_month", "two_months", "fixed"] as const;

const optionalMoney = z.union([z.literal(""), money]).transform((v) => v || null);

function checkFixed(rule: string, amount: string | null, path: string, ctx: z.RefinementCtx) {
  if (rule === "fixed" && !amount) ctx.addIssue({ code: "custom", path: [path], message: "Escribe el monto." });
}

// Configuración › Garantía.
export const depositSettingsSchema = z
  .object({
    roomRule: z.enum(RULES),
    roomFixedAmount: optionalMoney,
    apartmentRule: z.enum(RULES),
    apartmentFixedAmount: optionalMoney,
    covers: z.array(z.enum(INSPECTION_AREAS)),
    refundDays: z.coerce.number().int().min(1, "Entre 1 y 60 días.").max(60, "Entre 1 y 60 días."),
    refundMethods: z.array(z.enum(PAYMENT_METHODS)).min(1, "Elige al menos un método."),
    entryReportDays: z.coerce.number().int().min(0, "Entre 0 y 60 días.").max(60, "Entre 0 y 60 días."),
    prorateRent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    checkFixed(v.roomRule, v.roomFixedAmount, "roomFixedAmount", ctx);
    checkFixed(v.apartmentRule, v.apartmentFixedAmount, "apartmentFixedAmount", ctx);
  })
  .transform((v) => ({
    ...v,
    roomFixedAmount: v.roomRule === "fixed" ? v.roomFixedAmount : null,
    apartmentFixedAmount: v.apartmentRule === "fixed" ? v.apartmentFixedAmount : null,
  }));

export type DepositSettingsInput = z.input<typeof depositSettingsSchema>;
export type DepositSettingsData = z.output<typeof depositSettingsSchema>;

// Excepción por unidad (GA-02).
export const unitExceptionSchema = z
  .object({ unitId: z.uuid("Elige la unidad."), rule: z.enum(RULES), fixedAmount: z.union([z.literal(""), money]) })
  .superRefine((v, ctx) => checkFixed(v.rule, v.fixedAmount || null, "fixedAmount", ctx))
  .transform((v) => ({ ...v, fixedAmount: v.rule === "fixed" ? v.fixedAmount : null }));

export type UnitExceptionInput = z.input<typeof unitExceptionSchema>;

// Ruta de un archivo en el espacio privado: <negocio>/<ficha>/<carpeta>/<id>.<ext> (ver files.ts).
const filePath = z.string().max(250);

// Registrar un pago (arrendador) o mandar un comprobante (residente). El arrendador lo confirma al registrarlo.
export const paymentSchema = z.object({
  residentId: z.uuid("Elige al residente."),
  period,
  amount: positiveMoney,
  method: z.enum(PAYMENT_METHODS, "Elige cómo pagó."),
  paidOn: isoDate,
  operationCode: optionalText(60),
  proofPath: z.union([z.literal(""), filePath]).transform((v) => v || null),
});

export type PaymentInput = z.input<typeof paymentSchema>;
export type PaymentData = z.output<typeof paymentSchema>;

export const paymentReviewSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("confirmed") }),
  z.object({
    status: z.literal("rejected"),
    reason: z
      .string()
      .trim()
      .min(3, "Escribe el motivo: el residente lo verá.")
      .max(200, "Es demasiado largo."),
  }),
]);

// Lo que ya estaba mal al ingresar (residente). La foto es obligatoria: es la prueba.
export const entryReportSchema = z.object({
  contractId: z.uuid(),
  area: z.enum(INSPECTION_AREAS, "Elige qué es."),
  note: z.string().trim().min(3, "Cuenta qué encontraste.").max(300, "Es demasiado largo."),
  photoPath: filePath.min(1, "Sube una foto."),
});

export type EntryReportInput = z.input<typeof entryReportSchema>;

// Descuento de la liquidación (arrendador).
export const discountSchema = z.object({
  area: z.enum(INSPECTION_AREAS, "Elige el rubro."),
  note: z.string().trim().min(3, "Explica el descuento: el residente lo verá.").max(300, "Es demasiado largo."),
  amount: positiveMoney,
  photoPath: z.union([z.literal(""), filePath]).transform((v) => v || null),
  worseThanEntry: z.boolean(),
});

export type DiscountInput = z.input<typeof discountSchema>;

// Responder a una disputa: ajustar el monto o retirar el descuento.
export const disputeAnswerSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("adjust"), amount: positiveMoney }),
  z.object({ action: z.literal("withdraw") }),
]);

// Registrar una devolución (GA-15).
export const refundSchema = z.object({
  amount: positiveMoney,
  method: z.enum(PAYMENT_METHODS, "Elige cómo devolviste."),
  paidOn: isoDate,
  operationCode: optionalText(60),
  proofPath: z.union([z.literal(""), filePath]).transform((v) => v || null),
});

export type RefundInput = z.input<typeof refundSchema>;

// Respuesta del residente a su liquidación (GA-12, GA-14).
export const settlementResponseSchema = z.object({
  method: z.enum(PAYMENT_METHODS, "Elige dónde recibes."),
  account: z.string().trim().min(3, "Escribe tu número o cuenta.").max(80, "Es demasiado largo."),
  accept: z.boolean(),
});

export const disputeSchema = z.object({
  reason: z.string().trim().min(5, "Cuéntale al arrendador por qué no estás de acuerdo.").max(300, "Es demasiado largo."),
});
