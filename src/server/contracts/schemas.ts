import { z } from "zod";

// Formularios de contratos. Los campos llegan como texto; vacío = sin dato.

export const PAPERWORK_OPTIONS = ["none", "paper", "template"] as const;

export const PAPERWORK_LABEL: Record<(typeof PAPERWORK_OPTIONS)[number], string> = {
  none: "Sin contrato escrito",
  paper: "Contrato en papel",
  template: "Desde plantilla",
};

export const PAPERWORK_HINT: Record<(typeof PAPERWORK_OPTIONS)[number], string> = {
  none: "Solo se registra el acuerdo: unidad, fechas, renta y día de pago.",
  paper: "Usas tu propio papel. Cuando esté firmado, subes la foto o el PDF.",
  template: "La app arma el PDF con tu plantilla. Se imprime, se firma y se sube.",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.");

// Condiciones del contrato: lo que se puede cambiar al pasar a un contrato nuevo.
const termsShape = {
  unitId: z.uuid("Elige la unidad."),
  startDate: isoDate,
  endDate: z.union([z.literal(""), isoDate]).transform((v) => v || null),
  monthlyRent: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Escribe un monto, por ejemplo 650 o 650.50."),
  paymentDay: z.coerce.number().int().min(1, "Elige el día de pago.").max(31, "Elige el día de pago."),
  paperwork: z.enum(PAPERWORK_OPTIONS),
  templateId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
};

type Terms = {
  startDate: string;
  endDate: string | null;
  paperwork: (typeof PAPERWORK_OPTIONS)[number];
  templateId: string | null;
};

function checkTerms(v: Terms, ctx: z.RefinementCtx) {
  if (v.endDate && v.endDate < v.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "El fin no puede ser antes del inicio." });
  }
  if (v.paperwork === "template" && !v.templateId) {
    ctx.addIssue({ code: "custom", path: ["templateId"], message: "Elige la plantilla." });
  }
}

// La plantilla solo cuenta en la modalidad "desde plantilla".
const dropTemplate = <T extends Terms>(v: T): T => ({
  ...v,
  templateId: v.paperwork === "template" ? v.templateId : null,
});

// Garantía para esta persona (regla 5). Vacío = la de la unidad o la de Configuración › Garantía.
// Se decide al crear el contrato; al cambiar condiciones no se toca, porque la garantía pasa al contrato nuevo.
export const DEPOSIT_CHOICES = ["", "none", "one_month", "two_months", "fixed"] as const;

const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Escribe un monto, por ejemplo 650 o 650.50.");

const depositShape = {
  depositRule: z.enum(DEPOSIT_CHOICES).transform((v) => v || null),
  depositFixedAmount: z.union([z.literal(""), money]).transform((v) => v || null),
  // Cuándo se cobra (por ejemplo, "se la pido después"). Vacío = al inicio del contrato.
  depositDueDate: z.union([z.literal(""), isoDate]).transform((v) => v || null),
};

export const contractSchema = z
  .object({ residentId: z.uuid("Elige al residente."), ...termsShape, ...depositShape })
  .superRefine((v, ctx) => {
    checkTerms(v, ctx);
    if (v.depositRule === "fixed" && !v.depositFixedAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["depositFixedAmount"],
        message: "Escribe el monto de la garantía.",
      });
    }
    if (v.depositDueDate && v.depositDueDate < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["depositDueDate"],
        message: "No puede ser antes del inicio del contrato.",
      });
    }
  })
  .transform((v) => ({
    ...dropTemplate(v),
    depositFixedAmount: v.depositRule === "fixed" ? v.depositFixedAmount : null,
    depositDueDate: v.depositRule === "none" ? null : v.depositDueDate,
  }));

export const termsSchema = z.object(termsShape).superRefine(checkTerms).transform(dropTemplate);

export const paperworkSchema = z
  .object({ paperwork: z.enum(PAPERWORK_OPTIONS), templateId: termsShape.templateId })
  .superRefine((v, ctx) => {
    if (v.paperwork === "template" && !v.templateId) {
      ctx.addIssue({ code: "custom", path: ["templateId"], message: "Elige la plantilla." });
    }
  })
  .transform((v) => ({ ...v, templateId: v.paperwork === "template" ? v.templateId : null }));

export const endDateSchema = isoDate;

export type ContractFormInput = z.input<typeof contractSchema>;
export type ContractData = z.output<typeof contractSchema>;
export type TermsData = z.output<typeof termsSchema>;
