import { z } from "zod";

import { money } from "@/server/payments/schemas";

// Formularios de la pensión. Los campos llegan como texto; vacío = sin dato. Se validan en el servidor.

export const MEAL_TYPE_VALUES = ["breakfast", "lunch", "dinner"] as const;
export const SERVICE_MODE_VALUES = ["dine_in", "takeaway", "delivery"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Escribe una hora, por ejemplo 12:30.");

// Configuración › Pensión: cada comida con su horario y precio, la hora límite y cómo se sirve.
export const pensionSettingsSchema = z
  .object({
    confirmDeadline: clock,
    serviceModes: z.array(z.enum(SERVICE_MODE_VALUES)).min(1, "Elige al menos una forma de servir."),
    seatsPerTurn: z
      .string()
      .trim()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 1000), "Entre 1 y 1000."),
    acceptsExternal: z.boolean(),
    diets: z.array(z.string().trim().min(1).max(40)).max(20, "Máximo 20 dietas."),
    meals: z.array(
      z
        .object({
          type: z.enum(MEAL_TYPE_VALUES),
          active: z.boolean(),
          startTime: clock,
          endTime: clock,
          singlePrice: money,
        })
        .superRefine((m, ctx) => {
          if (m.active && m.endTime.slice(0, 5) <= m.startTime.slice(0, 5)) {
            ctx.addIssue({
              code: "custom",
              path: ["endTime"],
              message: "Tiene que terminar después de empezar.",
            });
          }
        }),
    ),
  })
  .superRefine((v, ctx) => {
    if (!v.meals.some((m) => m.active)) {
      ctx.addIssue({ code: "custom", path: ["meals"], message: "Activa al menos una comida." });
    }
  });

export type PensionSettingsInput = z.input<typeof pensionSettingsSchema>;
export type PensionSettingsData = z.output<typeof pensionSettingsSchema>;

// Plan de pensión (PN-01).
export const planSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre del plan.").max(80, "Es demasiado largo."),
  meals: z.array(z.enum(MEAL_TYPE_VALUES)).min(1, "Elige al menos una comida."),
  dailyPrice: money,
  active: z.boolean(),
});

export type PlanInput = z.input<typeof planSchema>;
export type PlanData = z.output<typeof planSchema>;

// Afiliar a un comensal a un plan (PN-04).
export const subscriptionSchema = z
  .object({
    residentId: z.uuid("Elige al comensal."),
    planId: z.uuid("Elige el plan."),
    startDate: isoDate,
    endDate: z.union([z.literal(""), isoDate]).transform((v) => v || null),
    dietNote: z
      .string()
      .trim()
      .max(200, "Es demasiado largo.")
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "No puede terminar antes de empezar." });
    }
  });

export type SubscriptionInput = z.input<typeof subscriptionSchema>;
export type SubscriptionData = z.output<typeof subscriptionSchema>;

// Pausar (PN-15).
export const pauseSchema = z.object({ fromDate: isoDate, toDate: isoDate });

// Menú de un día y una comida (PN-03). Plato vacío = se borra ese menú.
export const menuEntrySchema = z.object({
  date: isoDate,
  meal: z.enum(MEAL_TYPE_VALUES),
  dish: z.string().trim().max(200, "Es demasiado largo."),
  hasVegetarian: z.boolean(),
});

export const weekMenuSchema = z.object({
  entries: z.array(menuEntrySchema).max(21),
  publish: z.boolean(),
});

export type WeekMenuInput = z.input<typeof weekMenuSchema>;

// Confirmar asistencia (comensal o cocina) y marcar que comió.
export const attendanceSchema = z.object({
  residentId: z.uuid(),
  date: isoDate,
  meal: z.enum(MEAL_TYPE_VALUES),
  going: z.boolean(),
});
