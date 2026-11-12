import { z } from "zod";

// Formulario de requisito de documento (Configuración › Documentos).
export const DOCUMENT_FORMATS = ["pdf", "image"] as const;

export const FORMAT_LABEL: Record<(typeof DOCUMENT_FORMATS)[number], string> = { pdf: "PDF", image: "Foto" };

// Las dos listas de requisitos: para quien alquila un cuarto y para quien alquila un departamento completo.
export const UNIT_TYPES = ["room", "apartment"] as const;

export const UNIT_TYPE_LABEL: Record<(typeof UNIT_TYPES)[number], string> = {
  room: "Cuarto",
  apartment: "Departamento",
};

export const requirementSchema = z.object({
  unitType: z.enum(UNIT_TYPES),
  name: z.string().trim().min(2, "Ponle un nombre.").max(80, "Es demasiado largo."),
  description: z
    .string()
    .trim()
    .max(200, "Es demasiado largo.")
    .transform((v) => v || null),
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

// Sugerencias al rechazar un documento. El motivo se escribe libre; estas solo ayudan a no escribirlo cada vez.
export const REJECTION_REASONS = [
  "No se lee bien (ilegible)",
  "Está vencido",
  "No coincide con los datos",
  "Falta una cara",
] as const;

// Registro de un archivo ya subido al espacio privado (el tipo y el tamaño los lee el servidor desde Storage).
export const newDocumentSchema = z.object({
  residentId: z.uuid(),
  kind: z.enum(["requirement", "signed_contract", "other"]),
  requirementId: z.uuid().nullable(),
  contractId: z.uuid().nullable(),
  storagePath: z.string().max(200),
  fileName: z.string().trim().min(1).max(200),
});

export const reviewSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("verified") }),
  z.object({
    status: z.literal("rejected"),
    reason: z
      .string()
      .trim()
      .min(3, "Escribe el motivo: el residente lo verá.")
      .max(200, "Es demasiado largo."),
  }),
]);
