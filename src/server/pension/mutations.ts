import "server-only";

import { randomUUID } from "node:crypto";

import { and, between, eq, gte, lte, sql } from "drizzle-orm";

import type { db } from "@/db";
import {
  business,
  meal,
  mealAttendance,
  mealSettings,
  menuItem,
  pensionPause,
  pensionPayment,
  pensionPlan,
  pensionSubscription,
  person,
  resident,
} from "@/db/schema";
import { limaToday, type IsoDate } from "@/server/contracts/dates";
import { isFolderPathOf } from "@/server/documents/files";

import { pastMenuChanged } from "./menu-moves";
import {
  addDays,
  ALL_DAYS,
  coversDay,
  isServiceDay,
  kitchenProblem,
  overlapsSubscription,
  pauseProblem,
  pauseRemovable,
} from "./rules";
import type {
  NewDinerData,
  PensionSettingsData,
  PlanData,
  SubscriptionData,
  SubscriptionEditData,
} from "./schemas";

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

// Configuración › Comidas y planes: días de atención, hora de cancelación, formas de servir, capacidad, externos, dietas y las tres comidas.
export async function savePensionSettings(tx: Tx, businessId: string, data: PensionSettingsData) {
  await requirePension(tx, businessId);
  const settings = {
    cancelDeadline: data.cancelDeadline,
    serviceDays: data.serviceDays,
    serviceModes: data.serviceModes,
    seatsPerTurn: data.seatsPerTurn,
    acceptsExternal: data.acceptsExternal,
    acceptsPaymentProofs: data.acceptsPaymentProofs,
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

// La persona con sesión (para anotar quién registró un pago o cambió una comida).
async function myPersonId(tx: Tx) {
  const [me] = await tx
    .select({ id: person.id })
    .from(person)
    .where(eq(person.userId, sql`(select auth.uid())`))
    .limit(1);
  if (!me) throw new PensionError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
  return me.id;
}

// Un plan del negocio que se puede ofrecer (activo). keep: el plan que ya tenía la afiliación vale aunque esté
// desactivado.
async function requireOfferedPlan(tx: Tx, businessId: string, planId: string, keep?: string) {
  const [plan] = await tx
    .select({ id: pensionPlan.id, active: pensionPlan.active })
    .from(pensionPlan)
    .where(and(eq(pensionPlan.id, planId), eq(pensionPlan.businessId, businessId)))
    .limit(1);
  if (!plan) throw new PensionError("No encontramos ese plan. Recarga la página.");
  if (!plan.active && plan.id !== keep) throw new PensionError("Ese plan está desactivado: elige otro.");
}

// Un comensal (ficha) de una pensión de quien inició sesión.
async function requireDiner(tx: Tx, businessId: string, residentId: string) {
  await requirePension(tx, businessId);
  const [r] = await tx
    .select({ id: resident.id, personId: resident.personId })
    .from(resident)
    .where(and(eq(resident.id, residentId), eq(resident.businessId, businessId)))
    .limit(1);
  if (!r) throw new PensionError("No encontramos a ese comensal. Recarga la página.");
  return r;
}

const subscriptionsOf = (tx: Tx, residentId: string) =>
  tx
    .select({
      id: pensionSubscription.id,
      startDate: pensionSubscription.startDate,
      endDate: pensionSubscription.endDate,
    })
    .from(pensionSubscription)
    .where(eq(pensionSubscription.residentId, residentId));

// Una afiliación de una pensión de quien inició sesión (el RLS oculta las ajenas), con su negocio.
async function requireSubscription(tx: Tx, subscriptionId: string) {
  const [sub] = await tx
    .select({
      id: pensionSubscription.id,
      residentId: pensionSubscription.residentId,
      planId: pensionSubscription.planId,
      startDate: pensionSubscription.startDate,
      endDate: pensionSubscription.endDate,
      businessId: resident.businessId,
    })
    .from(pensionSubscription)
    .innerJoin(resident, eq(resident.id, pensionSubscription.residentId))
    .where(eq(pensionSubscription.id, subscriptionId))
    .limit(1);
  if (!sub) throw new PensionError("No encontramos esa afiliación. Recarga la página.");
  return sub;
}

// Agregar comensal (PN-04, PN-09): su ficha (solo nombre y celular o correo) y su afiliación, todo junto.
export async function addDiner(tx: Tx, businessId: string, data: NewDinerData): Promise<string> {
  await requirePension(tx, businessId);
  await requireOfferedPlan(tx, businessId, data.planId);
  // El id se crea aquí: el arrendador no puede leer a la persona hasta que exista su ficha (igual que Residentes).
  const personId = randomUUID();
  await tx
    .insert(person)
    .values({ id: personId, fullName: data.fullName, phone: data.phone, email: data.email });
  const [r] = await tx.insert(resident).values({ businessId, personId }).returning({ id: resident.id });
  await tx.insert(pensionSubscription).values({
    residentId: r.id,
    planId: data.planId,
    startDate: data.startDate,
    billingCycle: data.billingCycle,
    dietNote: data.dietNote,
  });
  return r.id;
}

// Cambiar nombre, celular o correo. Si ya tiene cuenta, sus datos los cambia él (y el RLS tampoco dejaría).
export async function updateDinerContact(
  tx: Tx,
  businessId: string,
  residentId: string,
  data: { fullName: string; phone: string | null; email: string | null },
) {
  const r = await requireDiner(tx, businessId, residentId);
  const [p] = await tx
    .select({ userId: person.userId })
    .from(person)
    .where(eq(person.id, r.personId))
    .limit(1);
  if (p?.userId) throw new PensionError("Ya tiene cuenta: sus datos los cambia desde su celular.");
  await tx.update(person).set(data).where(eq(person.id, r.personId));
}

// Afiliar de nuevo a un comensal (por ejemplo, después de terminar su plan). Una afiliación a la vez.
export async function subscribe(tx: Tx, businessId: string, data: SubscriptionData) {
  await requireDiner(tx, businessId, data.residentId);
  await requireOfferedPlan(tx, businessId, data.planId);
  if (overlapsSubscription(data, await subscriptionsOf(tx, data.residentId))) {
    throw new PensionError("Ya tiene una afiliación en esas fechas. Termina la actual primero.");
  }
  await tx.insert(pensionSubscription).values({
    residentId: data.residentId,
    planId: data.planId,
    startDate: data.startDate,
    endDate: data.endDate,
    billingCycle: data.billingCycle,
    dietNote: data.dietNote,
  });
}

// Cambiar el plan, cada cuánto paga, su dieta o hasta cuándo come (terminar = poner fecha de fin).
export async function updateSubscription(tx: Tx, subscriptionId: string, data: SubscriptionEditData) {
  const sub = await requireSubscription(tx, subscriptionId);
  await requireOfferedPlan(tx, sub.businessId, data.planId, sub.planId);
  if (data.endDate && data.endDate < sub.startDate) {
    throw new PensionError("No puede terminar antes de empezar.");
  }
  const others = (await subscriptionsOf(tx, sub.residentId)).filter((s) => s.id !== sub.id);
  if (overlapsSubscription({ startDate: sub.startDate, endDate: data.endDate }, others)) {
    throw new PensionError("Se cruzaría con otra afiliación de este comensal.");
  }
  await tx
    .update(pensionSubscription)
    .set({
      planId: data.planId,
      billingCycle: data.billingCycle,
      dietNote: data.dietNote,
      endDate: data.endDate,
    })
    .where(eq(pensionSubscription.id, sub.id));
}

// Pausar por un viaje (PN-15), hecho por la cocina. Mismas reglas que pause_my_pension: desde hoy, dentro de la
// afiliación, sin días servidos ni otra pausa. Los días pausados no se cocinan ni se cobran.
export async function addPause(tx: Tx, subscriptionId: string, from: IsoDate, to: IsoDate) {
  const sub = await requireSubscription(tx, subscriptionId);
  const [pauses, served] = await Promise.all([
    tx
      .select({ fromDate: pensionPause.fromDate, toDate: pensionPause.toDate })
      .from(pensionPause)
      .where(eq(pensionPause.subscriptionId, sub.id)),
    tx
      .select({ date: mealAttendance.date })
      .from(mealAttendance)
      .where(
        and(
          eq(mealAttendance.residentId, sub.residentId),
          eq(mealAttendance.served, true),
          between(mealAttendance.date, from, to),
        ),
      ),
  ]);
  const problem = pauseProblem({
    from,
    to,
    today: limaToday(new Date()),
    subscription: sub,
    pauses,
    servedDates: served.map((s) => s.date),
  });
  if (problem) throw new PensionError(problem);
  await tx.insert(pensionPause).values({ subscriptionId: sub.id, fromDate: from, toDate: to });
  await tx
    .delete(mealAttendance)
    .where(
      and(
        eq(mealAttendance.residentId, sub.residentId),
        between(mealAttendance.date, from, to),
        eq(mealAttendance.served, false),
      ),
    );
}

// Quitar una pausa que todavía no empezó (por ejemplo, canceló el viaje).
export async function removePause(tx: Tx, pauseId: string) {
  const [pause] = await tx
    .select({ id: pensionPause.id, fromDate: pensionPause.fromDate })
    .from(pensionPause)
    .where(eq(pensionPause.id, pauseId))
    .limit(1);
  if (!pause) throw new PensionError("No encontramos esa pausa. Recarga la página.");
  if (!pauseRemovable(pause, limaToday(new Date()))) {
    throw new PensionError("Esa pausa ya empezó: no se puede quitar.");
  }
  await tx.delete(pensionPause).where(eq(pensionPause.id, pause.id));
}

// La cocina cancela, vuelve a pedir o marca si comió (PN-06, PN-07). Puede hacerlo aunque haya pasado la hora
// límite; una cancelación tardía se cobra (lo calcula el estado de cuenta con la hora en que se hizo).
export async function kitchenChange(
  tx: Tx,
  businessId: string,
  input: {
    residentId: string;
    date: IsoDate;
    meal: "breakfast" | "lunch" | "dinner";
    change: "cancel" | "restore" | "served" | "not_served";
  },
) {
  await requireDiner(tx, businessId, input.residentId);
  const [st] = await tx
    .select({ serviceDays: mealSettings.serviceDays })
    .from(mealSettings)
    .where(eq(mealSettings.businessId, businessId))
    .limit(1);
  if (!isServiceDay(input.date, st?.serviceDays ?? ALL_DAYS)) {
    throw new PensionError("Ese día tu pensión no cocina.");
  }
  const subs = await tx
    .select({
      id: pensionSubscription.id,
      startDate: pensionSubscription.startDate,
      endDate: pensionSubscription.endDate,
      planMeals: pensionPlan.meals,
    })
    .from(pensionSubscription)
    .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
    .where(eq(pensionSubscription.residentId, input.residentId));
  const sub = subs.find((s) => coversDay(s, input.date)) ?? null;
  const pauses = sub
    ? await tx
        .select({ fromDate: pensionPause.fromDate, toDate: pensionPause.toDate })
        .from(pensionPause)
        .where(eq(pensionPause.subscriptionId, sub.id))
    : [];
  const problem = kitchenProblem({ date: input.date, meal: input.meal, subscription: sub, pauses });
  if (problem) throw new PensionError(problem);
  if ((input.change === "served" || input.change === "not_served") && input.date > limaToday(new Date())) {
    throw new PensionError("Todavía no llega ese día.");
  }
  const updatedBy = await myPersonId(tx);
  const key = and(
    eq(mealAttendance.residentId, input.residentId),
    eq(mealAttendance.date, input.date),
    eq(mealAttendance.meal, input.meal),
  );
  const upsert = (values: { cancelled: boolean; served: boolean }) =>
    tx
      .insert(mealAttendance)
      .values({ residentId: input.residentId, date: input.date, meal: input.meal, updatedBy, ...values })
      .onConflictDoUpdate({
        target: [mealAttendance.residentId, mealAttendance.date, mealAttendance.meal],
        set: { ...values, updatedBy, updatedAt: new Date() },
      });
  if (input.change === "cancel") await upsert({ cancelled: true, served: false });
  else if (input.change === "served") await upsert({ cancelled: false, served: true });
  // Sin fila = viene (por defecto se cocina).
  else if (input.change === "restore") {
    await tx.delete(mealAttendance).where(and(key, eq(mealAttendance.served, false)));
  } else await tx.delete(mealAttendance).where(and(key, eq(mealAttendance.cancelled, false)));
}

type MealKind = "breakfast" | "lunch" | "dinner";

// Menú de una semana (PN-03): un plato por día y comida; vacío = se borra. Publicar lo deja visible para los
// comensales; guardar sin publicar lo deja como borrador. Todo va en la misma transacción, así que mover o
// intercambiar comidas entre días nunca queda a medias. El menú de un día que ya pasó no se cambia ni se borra
// (decisión del dueño, 2026-11-13): si llega igual se ignora; si llega distinto, se rechaza.
export async function saveWeekMenu(
  tx: Tx,
  businessId: string,
  entries: { date: IsoDate; meal: MealKind; dish: string; hasVegetarian: boolean }[],
  publish: boolean,
) {
  await requirePension(tx, businessId);
  const today = limaToday(new Date());
  const past = entries.filter((e) => e.date < today);
  if (past.length) {
    const dates = past.map((e) => e.date).sort();
    const saved = await tx
      .select({
        date: menuItem.date,
        meal: menuItem.meal,
        dish: menuItem.dish,
        hasVegetarian: menuItem.hasVegetarian,
      })
      .from(menuItem)
      .where(
        and(
          eq(menuItem.businessId, businessId),
          gte(menuItem.date, dates[0]),
          lte(menuItem.date, dates[dates.length - 1]),
        ),
      );
    if (pastMenuChanged(saved, past, today)) {
      throw new PensionError("El menú de un día que ya pasó no se cambia. Cópialo y pégalo en otro día.");
    }
  }
  const status = publish ? ("published" as const) : ("draft" as const);
  for (const e of entries.filter((x) => x.date >= today)) {
    const key = and(
      eq(menuItem.businessId, businessId),
      eq(menuItem.date, e.date),
      eq(menuItem.meal, e.meal),
    );
    if (!e.dish) {
      await tx.delete(menuItem).where(key);
      continue;
    }
    await tx
      .insert(menuItem)
      .values({
        businessId,
        date: e.date,
        meal: e.meal,
        dish: e.dish,
        hasVegetarian: e.hasVegetarian,
        status,
      })
      .onConflictDoUpdate({
        target: [menuItem.businessId, menuItem.date, menuItem.meal],
        set: { dish: e.dish, hasVegetarian: e.hasVegetarian, status },
      });
  }
}

// Copiar la semana anterior a esta (como borrador), sin pisar lo que ya esté escrito ni los días que ya pasaron.
export async function copyPreviousWeek(tx: Tx, businessId: string, monday: IsoDate) {
  await requirePension(tx, businessId);
  const today = limaToday(new Date());
  const previous = await tx
    .select()
    .from(menuItem)
    .where(
      and(
        eq(menuItem.businessId, businessId),
        gte(menuItem.date, addDays(monday, -7)),
        lte(menuItem.date, addDays(monday, -1)),
      ),
    );
  if (!previous.length) throw new PensionError("La semana anterior no tiene menú.");
  const toCopy = previous.filter((p) => addDays(p.date, 7) >= today);
  if (!toCopy.length) throw new PensionError("Los días de esta semana ya pasaron: no hay dónde copiar.");
  await tx
    .insert(menuItem)
    .values(
      toCopy.map((p) => ({
        businessId,
        date: addDays(p.date, 7),
        meal: p.meal,
        dish: p.dish,
        hasVegetarian: p.hasVegetarian,
        status: "draft" as const,
      })),
    )
    .onConflictDoNothing();
}

// Registrar un pago por adelantado: cuánto y qué días cubre. Queda en la bitácora (trigger de la base).
export async function registerPensionPayment(
  tx: Tx,
  data: {
    subscriptionId: string;
    amount: string;
    method: (typeof pensionPayment.$inferInsert)["method"];
    paidOn: IsoDate;
    coversFrom: IsoDate;
    coversTo: IsoDate;
    note: string | null;
  },
) {
  const sub = await requireSubscription(tx, data.subscriptionId);
  if (data.coversFrom < sub.startDate || (sub.endDate !== null && data.coversTo > sub.endDate)) {
    throw new PensionError("Los días que cubre tienen que estar dentro de su afiliación.");
  }
  const me = await myPersonId(tx);
  // Lo registra la cocina: queda confirmado (cuenta para el saldo desde ya).
  await tx
    .insert(pensionPayment)
    .values({ ...data, status: "confirmed", registeredBy: me, reviewedBy: me, reviewedAt: new Date() });
}

// El comensal avisa su pago con el comprobante (decisión del dueño, 2026-11-13): solo si su pensión lo permite;
// queda en revisión y no cuenta hasta que la cocina lo apruebe. El RLS de la base revisa lo mismo.
export async function submitPensionProof(
  tx: Tx,
  data: {
    subscriptionId: string;
    amount: string;
    method: (typeof pensionPayment.$inferInsert)["method"];
    paidOn: IsoDate;
    coversFrom: IsoDate;
    coversTo: IsoDate;
    operationCode: string | null;
    proofPath: string;
  },
) {
  const sub = await requireSubscription(tx, data.subscriptionId);
  const [st] = await tx
    .select({ accepts: mealSettings.acceptsPaymentProofs })
    .from(mealSettings)
    .where(eq(mealSettings.businessId, sub.businessId))
    .limit(1);
  if (!st?.accepts) throw new PensionError("Tu pensión no recibe comprobantes por aquí. Avísale por WhatsApp.");
  if (!isFolderPathOf(data.proofPath, sub.businessId, sub.residentId, "comprobantes")) {
    throw new PensionError("Sube la foto o el PDF de tu comprobante.");
  }
  if (data.coversFrom < sub.startDate || (sub.endDate !== null && data.coversTo > sub.endDate)) {
    throw new PensionError("Los días que cubre tienen que estar dentro de tu plan.");
  }
  await tx.insert(pensionPayment).values({
    ...data,
    note: null,
    status: "in_review",
    registeredBy: await myPersonId(tx),
  });
}

// La cocina aprueba o rechaza un comprobante que está en revisión. Rechazar pide un motivo (el comensal lo ve).
export async function reviewPensionPayment(
  tx: Tx,
  paymentId: string,
  review: { status: "confirmed" } | { status: "rejected"; reason: string },
) {
  const [current] = await tx
    .select({ status: pensionPayment.status })
    .from(pensionPayment)
    .where(eq(pensionPayment.id, paymentId))
    .limit(1);
  if (!current) throw new PensionError("No encontramos ese pago. Recarga la página.");
  if (current.status !== "in_review") throw new PensionError("Ese pago ya fue revisado.");
  const updated = await tx
    .update(pensionPayment)
    .set({
      status: review.status,
      rejectionReason: review.status === "rejected" ? review.reason : null,
      reviewedBy: await myPersonId(tx),
      reviewedAt: new Date(),
    })
    .where(and(eq(pensionPayment.id, paymentId), eq(pensionPayment.status, "in_review")))
    .returning({ id: pensionPayment.id });
  // El RLS solo deja cambiarlo a la cocina de esa pensión.
  if (!updated.length) throw new PensionError("No puedes revisar ese pago.");
}

// Quitar un pago registrado por error. La bitácora conserva lo que había (trigger de la base).
export async function deletePensionPayment(tx: Tx, paymentId: string) {
  const deleted = await tx
    .delete(pensionPayment)
    .where(eq(pensionPayment.id, paymentId))
    .returning({ id: pensionPayment.id });
  if (!deleted.length) throw new PensionError("No encontramos ese pago. Recarga la página.");
}
