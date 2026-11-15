import { z } from "zod";

// Formulario de un ingreso o una salida. La hora llega como "AAAA-MM-DDTHH:MM" en hora de Lima (sin cambio de hora:
// siempre UTC−5).
export const limaDateTime = (value: string) => new Date(`${value}:00-05:00`);

export const moveSchema = z.object({
  kind: z.enum(["check_in", "check_out"]),
  scheduledAt: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Elige día y hora.")
    .transform((v) => (v ? limaDateTime(v) : null)),
  keysCount: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 20), "Entre 0 y 20."),
  checklist: z.record(z.string(), z.boolean()),
  notes: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 letras.")
    .transform((v) => v || null),
  done: z.boolean(),
});
export type MoveData = z.infer<typeof moveSchema>;
