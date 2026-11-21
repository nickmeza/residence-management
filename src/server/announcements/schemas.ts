import { z } from "zod";

// Formulario "Nuevo comunicado". Se valida en el servidor.
export const announcementSchema = z
  .object({
    audience: z.enum(["all", "property", "floor", "resident"]),
    targetId: z.uuid().nullable(),
    title: z.string().trim().min(3, "Escribe un título corto.").max(120, "Máximo 120 letras."),
    body: z.string().trim().min(1, "Escribe el mensaje.").max(2000, "Máximo 2000 letras."),
    urgent: z.boolean(),
  })
  .refine((v) => v.audience === "all" || v.targetId !== null, {
    path: ["targetId"],
    message: "Elige a quién se lo mandas.",
  });
export type AnnouncementData = z.infer<typeof announcementSchema>;
