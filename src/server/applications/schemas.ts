import { z } from "zod";

// Formulario público de postulación. Lo llena alguien sin cuenta: se valida todo en el servidor.
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Es demasiado largo.")
    .transform((v) => v || null);

export const applicationSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre completo.").max(120, "Es demasiado largo."),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{5,19}$/, "Escribe tu celular, por ejemplo 987 654 321."),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Escribe un correo válido.")
    .transform((v) => v || null),
  unitType: z.enum(["", "room", "apartment"]).transform((v) => v || null),
  moveInDate: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Elige una fecha.")
    .transform((v) => v || null),
  months: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 60), "Entre 1 y 60 meses."),
  budget: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,8}(\.\d{1,2})?$/.test(v), "Escribe un monto, por ejemplo 650.")
    .transform((v) => v || null),
  occupation: optional(120),
  message: optional(1000),
  // Casilla de privacidad: sin aceptarla no se guarda nada (datos personales).
  accepts: z.literal(true, { error: "Necesitamos tu permiso para guardar tus datos." }),
});
export type ApplicationData = z.infer<typeof applicationSchema>;

export const applicationReviewSchema = z.object({
  status: z.enum(["waitlist", "approved", "rejected"]),
  note: optional(500),
});
