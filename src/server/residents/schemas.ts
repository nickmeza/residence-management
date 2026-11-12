import { z } from "zod";

// Formulario de agregar o editar residente. Los campos de texto llegan como texto; vacío = sin dato.
export const IDENTITY_DOCUMENT_TYPES = ["dni", "foreign_id", "passport"] as const;

export const IDENTITY_DOCUMENT_LABEL: Record<(typeof IDENTITY_DOCUMENT_TYPES)[number], string> = {
  dni: "DNI",
  foreign_id: "Carné de extranjería",
  passport: "Pasaporte",
};

const optionalText = z
  .string()
  .trim()
  .max(200, "Es demasiado largo.")
  .transform((v) => v || null);

const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[+\d][\d\s-]{5,19}$/.test(v), "Escribe solo números, por ejemplo 987 654 321.")
  .transform((v) => v || null);

export const residentSchema = z
  .object({
    fullName: z.string().trim().min(2, "Escribe el nombre completo.").max(120, "Es demasiado largo."),
    phone,
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.email().safeParse(v).success, "Escribe un correo válido.")
      .transform((v) => v || null),
    identityDocumentType: z.enum(["", ...IDENTITY_DOCUMENT_TYPES]).transform((v) => v || null),
    identityDocumentNumber: z
      .string()
      .trim()
      .max(20, "Es demasiado largo.")
      .transform((v) => v || null),
    university: optionalText,
    emergencyContactName: optionalText,
    emergencyContactPhone: phone,
    notes: z
      .string()
      .trim()
      .max(1000, "Es demasiado largo.")
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    // Tipo y número van juntos (la base también lo exige).
    if (v.identityDocumentType && !v.identityDocumentNumber) {
      ctx.addIssue({ code: "custom", path: ["identityDocumentNumber"], message: "Escribe el número." });
    }
    if (!v.identityDocumentType && v.identityDocumentNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["identityDocumentType"],
        message: "Elige el tipo de documento.",
      });
    }
    if (
      v.identityDocumentType === "dni" &&
      v.identityDocumentNumber &&
      !/^\d{8}$/.test(v.identityDocumentNumber)
    ) {
      ctx.addIssue({ code: "custom", path: ["identityDocumentNumber"], message: "El DNI tiene 8 dígitos." });
    }
  });

export type ResidentInput = z.input<typeof residentSchema>;
export type ResidentData = z.output<typeof residentSchema>;

// Lo que es de la persona (compartido entre negocios), lo que es de la ficha de este negocio y las notas, que son
// solo del arrendador (tabla resident_note: el residente no las puede leer).
export function splitResident(data: ResidentData) {
  const { university, emergencyContactName, emergencyContactPhone, notes, ...personal } = data;
  return { personal, card: { university, emergencyContactName, emergencyContactPhone }, notes };
}
