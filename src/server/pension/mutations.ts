import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { db } from "@/db";
import { business, meal, mealSettings, pensionPlan, pensionSubscription } from "@/db/schema";

import type { PensionSettingsData, PlanData } from "./schemas";

// Cambios de la pensión. Cada función recibe una transacción que ya corre como el usuario con sesión (withRls), así
// que el RLS decide qué puede tocar; aquí se revisan las reglas que el RLS no sabe.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PensionError extends Error {}

// ¿Es un negocio de Pensión de quien inició sesión?
async function requirePension(tx: Tx, businessId: string) {
  const [b] = await tx
    .select({ id: business.id })
    .from(business)
    .where(and(eq(business.id, businessId), eq(business.service, "meal_plan")))
    .limit(1);
  if (!b) throw new PensionError("No encontramos tu pensión. Recarga la página.");
}

// Configuración › Pensión: hora de cancelación, formas de servir, capacidad, externos, dietas y las tres comidas.
export async function savePensionSettings(tx: Tx, businessId: string, data: PensionSettingsData) {
  await requirePension(tx, businessId);
  const settings = {
    cancelDeadline: data.cancelDeadline,
    serviceModes: data.serviceModes,
    seatsPerTurn: data.seatsPerTurn,
    acceptsExternal: data.acceptsExternal,
    diets: [...new Set(data.diets)],
    updatedAt: new Date(),
  };
  await tx
    .insert(mealSettings)
    .values({ businessId, ...settings })
    .onConflictDoUpdate({ target: mealSettings.businessId, set: settings });
  for (const m of data.meals) {
    const values = {
      startTime: m.startTime,
      endTime: m.endTime,
      singlePrice: m.singlePrice,
      active: m.active,
    };
    await tx
      .insert(meal)
      .values({ businessId, type: m.type, ...values })
      .onConflictDoUpdate({ target: [meal.businessId, meal.type], set: values });
  }
}

// Crear o editar un plan. Un plan con comensales afiliados no se borra: se desactiva (no se ofrece a nuevos).
export async function savePlan(tx: Tx, businessId: string, planId: string | null, data: PlanData) {
  await requirePension(tx, businessId);
  const values = {
    name: data.name,
    meals: [...new Set(data.meals)],
    dailyPrice: data.dailyPrice,
    active: data.active,
  };
  if (planId === null) {
    await tx.insert(pensionPlan).values({ businessId, ...values });
    return;
  }
  const updated = await tx
    .update(pensionPlan)
    .set(values)
    .where(and(eq(pensionPlan.id, planId), eq(pensionPlan.businessId, businessId)))
    .returning({ id: pensionPlan.id });
  if (!updated.length) throw new PensionError("No encontramos ese plan. Recarga la página.");
}

export async function deletePlan(tx: Tx, businessId: string, planId: string) {
  await requirePension(tx, businessId);
  const [used] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(pensionSubscription)
    .where(eq(pensionSubscription.planId, planId));
  if (used.n > 0) {
    throw new PensionError("Este plan tiene comensales afiliados: desactívalo en lugar de borrarlo.");
  }
  const deleted = await tx
    .delete(pensionPlan)
    .where(and(eq(pensionPlan.id, planId), eq(pensionPlan.businessId, businessId)))
    .returning({ id: pensionPlan.id });
  if (!deleted.length) throw new PensionError("No encontramos ese plan. Recarga la página.");
}
