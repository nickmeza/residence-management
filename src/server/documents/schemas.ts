import { z } from "zod";

// Formulario de requisito de documento (Configuración › Documentos).
export const DOCUMENT_FORMATS = ["pdf", "image"] as const;

export const FORMAT_LABEL: Record<(typeof DOCUMENT_FORMATS)[number], string> = { pdf: "PDF", image: "Foto" };

export const requirementSchema = z.object({
  name: z.string().trim().min(2, "Ponle un nombre.").max(80, "Es demasiado largo."),
  description: z
    .string()
    .trim()
    .max(200, "Es demasiado largo.")
    .transform((v) => v || null),
  // Vacío: vale para todo el negocio.
  propertyId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  required: z.boolean(),
  acceptedFormats: z.array(z.enum(DOCUMENT_FORMATS)).min(1, "Elige al menos un formato."),
  maxSizeMb: z.coerce.number().int().min(1, "Entre 1 y 20 MB.").max(20, "Entre 1 y 20 MB."),
});

export type RequirementInput = z.input<typeof requirementSchema>;
export type RequirementData = z.output<typeof requirementSchema>;

// "Foto o PDF, máximo 5 MB."
export function formatsHint(formats: readonly (typeof DOCUMENT_FORMATS)[number][], maxSizeMb: number) {
  const names = formats.map((f) => FORMAT_LABEL[f]).join(" o ");
  return `${names}, máximo ${maxSizeMb} MB.`;
}
