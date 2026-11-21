import { z } from "zod";

import { money } from "@/server/payments/schemas";

import { KIND_VALUES, PERIOD_VALUES } from "./rules";

// Formularios de tareas que se repiten y de proveedores. Se validan en el servidor.

const isoDate = z.iso.date({ error: "Elige una fecha." });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} letras.`)
    .transform((v) => v || null);

export const taskSchema = z.object({
  kind: z.enum(KIND_VALUES),
  title: z.string().trim().min(3, "Escribe qué hay que hacer.").max(120, "Máximo 120 letras."),
  place: optionalText(120),
  propertyId: z.uuid().nullable(),
  every: z.coerce.number().int().min(1, "Mínimo 1.").max(365, "Máximo 365."),
  period: z.enum(PERIOD_VALUES),
  nextDue: isoDate,
  supplierId: z.uuid().nullable(),
  notes: optionalText(1000),
});
export type TaskData = z.infer<typeof taskSchema>;

export const doneSchema = z.object({
  doneOn: isoDate,
  cost: z.union([z.literal("").transform(() => null), money]),
  supplierId: z.uuid().nullable(),
  note: optionalText(500),
});
export type DoneData = z.infer<typeof doneSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre.").max(120, "Máximo 120 letras."),
  trade: optionalText(60),
  phone: optionalText(30),
  note: optionalText(500),
});
export type SupplierData = z.infer<typeof supplierSchema>;
