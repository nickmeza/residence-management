import { z } from "zod";

import { money } from "@/server/payments/schemas";

import { CATEGORY_VALUES, PRIORITY_VALUES, RESIDENT_PRIORITIES, STATUS_VALUES } from "./rules";

// Formularios de mantenimiento. Se validan en el servidor (los del navegador son solo ayuda).

const title = z
  .string()
  .trim()
  .min(3, "Cuéntanos en pocas palabras qué pasa.")
  .max(120, "Máximo 120 letras: el detalle va abajo.");
const description = z
  .string()
  .trim()
  .max(2000, "Es demasiado largo.")
  .transform((v) => v || null);
const photoPath = z.string().min(1).max(300).nullable();
const assignee = z
  .string()
  .trim()
  .max(80, "Máximo 80 letras.")
  .transform((v) => v || null);

// El residente pide desde su contrato (la unidad la saca el servidor del contrato, no del navegador).
export const residentRequestSchema = z.object({
  residentId: z.uuid(),
  contractId: z.uuid(),
  title,
  description,
  category: z.enum(CATEGORY_VALUES),
  priority: z.enum(RESIDENT_PRIORITIES),
  photoPath,
});
export type ResidentRequestData = z.infer<typeof residentRequestSchema>;

// El arrendador registra un pedido (lo vio él o se lo dijeron por WhatsApp). Sin unidad = área común.
export const landlordRequestSchema = z.object({
  unitId: z.uuid().nullable(),
  title,
  description,
  category: z.enum(CATEGORY_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  blocksUnit: z.boolean(),
  assignee,
  photoPath,
});
export type LandlordRequestData = z.infer<typeof landlordRequestSchema>;

// Detalle del pedido (MT-03): estado, prioridad, responsable, costo y si deja la unidad fuera de servicio.
export const requestUpdateSchema = z.object({
  status: z.enum(STATUS_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  assignee,
  cost: z.union([z.literal("").transform(() => null), money]),
  blocksUnit: z.boolean(),
});
export type RequestUpdateData = z.infer<typeof requestUpdateSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escribe algo.").max(1000, "Máximo 1000 letras."),
});
