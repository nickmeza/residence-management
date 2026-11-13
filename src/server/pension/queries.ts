import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
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
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { limaToday, type IsoDate } from "@/server/contracts/dates";

import {
  addDays,
  ALL_DAYS,
  attendanceState,
  coversDay,
  hhmm,
  isPaused,
  isServiceDay,
  kitchenCounts,
  cancelDeadline,
  limaNow,
  MEAL_TYPES,
  pensionAccount,
  planPriceWarning,
  type AttendanceState,
  type BillingCycle,
  type MealType,
  type ServiceMode,
} from "./rules";

// Lo que leen las pantallas de la pensión. Todo con la sesión (RLS): el arrendador ve lo de sus negocios y el
// comensal lo suyo (comidas, planes y menú publicado de las pensiones donde tiene ficha).

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export type MealRow = {
  type: MealType;
  startTime: string;
  endTime: string;
  singlePrice: string;
  active: boolean;
};

// Horarios y precios de ejemplo para una pensión que todavía no configuró sus comidas.
const DEFAULT_MEALS: Record<MealType, Omit<MealRow, "type">> = {
  breakfast: { startTime: "07:00", endTime: "09:00", singlePrice: "5.00", active: true },
  lunch: { startTime: "12:30", endTime: "14:30", singlePrice: "11.00", active: true },
  dinner: { startTime: "19:00", endTime: "21:00", singlePrice: "8.00", active: true },
};

async function loadMeals(tx: Tx, businessId: string): Promise<{ meals: MealRow[]; saved: boolean }> {
  const rows = await tx
    .select({
      type: meal.type,
      startTime: meal.startTime,
      endTime: meal.endTime,
      singlePrice: meal.singlePrice,
      active: meal.active,
    })
    .from(meal)
    .where(eq(meal.businessId, businessId));
  return {
    saved: rows.length > 0,
    meals: MEAL_TYPES.map((type) => {
      const r = rows.find((x) => x.type === type);
      return r
        ? { ...r, startTime: hhmm(r.startTime), endTime: hhmm(r.endTime) }
        : { type, ...DEFAULT_MEALS[type], active: rows.length === 0 };
    }),
  };
}

async function loadSettings(tx: Tx, businessId: string) {
  const [s] = await tx.select().from(mealSettings).where(eq(mealSettings.businessId, businessId)).limit(1);
  return {
    cancelDeadline: hhmm(s?.cancelDeadline ?? "20:00"),
    serviceDays: s?.serviceDays ?? ALL_DAYS,
    serviceModes: (s?.serviceModes ?? ["dine_in"]) as ServiceMode[],
    seatsPerTurn: s?.seatsPerTurn ?? null,
    acceptsExternal: s?.acceptsExternal ?? true,
    acceptsPaymentProofs: s?.acceptsPaymentProofs ?? false,
    diets: s?.diets ?? [],
  };
}

// Estado de cuenta de una afiliación (cobro por adelantado): sus pagos, sus cancelaciones hechas a tiempo (antes de
// la hora límite del día anterior, en hora de Lima) y el cálculo de pensionAccount.
async function loadAccount(
  tx: Tx,
  sub: {
    id: string;
    residentId: string;
    dailyPrice: string;
    planMeals: MealType[];
    billingCycle: BillingCycle;
    startDate: IsoDate;
    endDate: IsoDate | null;
  },
  pauses: { fromDate: IsoDate; toDate: IsoDate }[],
  settings: { cancelDeadline: string; serviceDays: number[] },
  today: IsoDate,
) {
  const [payments, cancelled] = await Promise.all([
    tx
      .select({
        id: pensionPayment.id,
        amount: pensionPayment.amount,
        method: pensionPayment.method,
        paidOn: pensionPayment.paidOn,
        coversFrom: pensionPayment.coversFrom,
        coversTo: pensionPayment.coversTo,
        note: pensionPayment.note,
        status: pensionPayment.status,
        operationCode: pensionPayment.operationCode,
        hasProof: sql<boolean>`${pensionPayment.proofPath} is not null`,
        rejectionReason: pensionPayment.rejectionReason,
      })
      .from(pensionPayment)
      .where(eq(pensionPayment.subscriptionId, sub.id))
      .orderBy(desc(pensionPayment.createdAt)),
    tx
      .select({ date: mealAttendance.date, updatedAt: mealAttendance.updatedAt })
      .from(mealAttendance)
      .where(
        and(
          eq(mealAttendance.residentId, sub.residentId),
          eq(mealAttendance.cancelled, true),
          gte(mealAttendance.date, sub.startDate),
        ),
      ),
  ]);
  const cancelledOnTime = cancelled
    .filter((c) => limaNow(c.updatedAt) < cancelDeadline(c.date, settings.cancelDeadline))
    .map((c) => c.date);
  return {
    payments,
    ...pensionAccount({
      today,
      dailyPrice: sub.dailyPrice,
      mealsPerDay: sub.planMeals.length,
      cycle: sub.billingCycle,
      subscription: sub,
      pauses,
      cancelledOnTime,
      serviceDays: settings.serviceDays,
      // Solo cuentan los pagos confirmados (los en revisión o rechazados, no).
      payments: payments.filter((p) => p.status === "confirmed"),
    }),
  };
}

// ¿Es un negocio de Pensión de quien inició sesión? Devuelve su nombre.
async function pensionBusiness(tx: Tx, businessId: string) {
  const [b] = await tx
    .select({ tradeName: business.tradeName })
    .from(business)
    .where(and(eq(business.id, businessId), eq(business.service, "meal_plan")))
    .limit(1);
  return b ?? null;
}

export type PlanRow = {
  id: string;
  name: string;
  meals: MealType[];
  dailyPrice: string;
  active: boolean;
  warning: string | null;
};

export type SubscriptionRow = {
  id: string;
  residentId: string;
  residentName: string;
  planId: string;
  planName: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  dietNote: string | null;
  pauses: { id: string; fromDate: IsoDate; toDate: IsoDate }[];
  state: "active" | "paused" | "upcoming" | "ended";
};

export type PensionAdminView = {
  businessId: string;
  tradeName: string;
  today: IsoDate;
  settings: Awaited<ReturnType<typeof loadSettings>>;
  meals: MealRow[];
  mealsSaved: boolean;
  plans: PlanRow[];
  subscriptions: SubscriptionRow[];
  // Fichas del negocio de Pensión que se pueden afiliar (comensales).
  diners: { id: string; name: string }[];
};

async function loadSubscriptions(tx: Tx, businessId: string, today: IsoDate): Promise<SubscriptionRow[]> {
  const subs = await tx
    .select({
      id: pensionSubscription.id,
      residentId: pensionSubscription.residentId,
      residentName: person.fullName,
      planId: pensionSubscription.planId,
      planName: pensionPlan.name,
      startDate: pensionSubscription.startDate,
      endDate: pensionSubscription.endDate,
      dietNote: pensionSubscription.dietNote,
    })
    .from(pensionSubscription)
    .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
    .innerJoin(resident, eq(resident.id, pensionSubscription.residentId))
    .innerJoin(person, eq(person.id, resident.personId))
    .where(eq(resident.businessId, businessId))
    .orderBy(asc(person.fullName));
  const pauses = subs.length
    ? await tx
        .select({
          id: pensionPause.id,
          subscriptionId: pensionPause.subscriptionId,
          fromDate: pensionPause.fromDate,
          toDate: pensionPause.toDate,
        })
        .from(pensionPause)
        .where(
          inArray(
            pensionPause.subscriptionId,
            subs.map((s) => s.id),
          ),
        )
        .orderBy(asc(pensionPause.fromDate))
    : [];
  return subs.map((s) => {
    const own = pauses.filter((p) => p.subscriptionId === s.id);
    const state: SubscriptionRow["state"] =
      s.startDate > today
        ? "upcoming"
        : s.endDate !== null && s.endDate < today
          ? "ended"
          : isPaused(today, own)
            ? "paused"
            : "active";
    return { ...s, pauses: own, state };
  });
}

export async function getPensionAdmin(businessId: string): Promise<PensionAdminView | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const b = await pensionBusiness(tx, businessId);
    if (!b) return null;
    const [settings, { meals, saved }, plans, subscriptions, diners] = await Promise.all([
      loadSettings(tx, businessId),
      loadMeals(tx, businessId),
      tx
        .select({
          id: pensionPlan.id,
          name: pensionPlan.name,
          meals: pensionPlan.meals,
          dailyPrice: pensionPlan.dailyPrice,
          active: pensionPlan.active,
        })
        .from(pensionPlan)
        .where(eq(pensionPlan.businessId, businessId))
        .orderBy(asc(pensionPlan.name)),
      loadSubscriptions(tx, businessId, today),
      tx
        .select({ id: resident.id, name: person.fullName })
        .from(resident)
        .innerJoin(person, eq(person.id, resident.personId))
        .where(eq(resident.businessId, businessId))
        .orderBy(asc(person.fullName)),
    ]);
    return {
      businessId,
      tradeName: b.tradeName,
      today,
      settings,
      meals,
      mealsSaved: saved,
      plans: plans.map((p) => ({ ...p, warning: planPriceWarning(p, meals) })),
      subscriptions,
      diners,
    };
  });
}

export type KitchenDiner = {
  residentId: string;
  name: string;
  dietNote: string | null;
  state: AttendanceState;
  served: boolean;
};

export type KitchenMeal = {
  type: MealType;
  startTime: string;
  deadline: string;
  menu: { dish: string; hasVegetarian: boolean; published: boolean } | null;
  diners: KitchenDiner[];
  counts: ReturnType<typeof kitchenCounts>;
};

export type KitchenView = {
  businessId: string;
  date: IsoDate;
  today: IsoDate;
  // false = ese día la pensión no cocina (no hay comidas).
  serviceDay: boolean;
  // Días que cocina (1 = lunes … 7 = domingo): las flechas de día saltan los demás.
  serviceDays: number[];
  meals: KitchenMeal[];
};

// Panel de cocina de un día (PN-06, PN-07, PN-08): por comida, cuántas porciones (todos menos los que cancelaron
// o pausaron), quién canceló y quién comió.
export async function getKitchenDay(businessId: string, date: IsoDate): Promise<KitchenView | null> {
  if (!isUuid(businessId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    if (!(await pensionBusiness(tx, businessId))) return null;
    const [settings, { meals }, subs, attendance, menu] = await Promise.all([
      loadSettings(tx, businessId),
      loadMeals(tx, businessId),
      loadSubscriptions(tx, businessId, date),
      tx
        .select({
          residentId: mealAttendance.residentId,
          meal: mealAttendance.meal,
          cancelled: mealAttendance.cancelled,
          served: mealAttendance.served,
        })
        .from(mealAttendance)
        .innerJoin(resident, eq(resident.id, mealAttendance.residentId))
        .where(and(eq(resident.businessId, businessId), eq(mealAttendance.date, date))),
      tx
        .select({
          meal: menuItem.meal,
          dish: menuItem.dish,
          hasVegetarian: menuItem.hasVegetarian,
          status: menuItem.status,
        })
        .from(menuItem)
        .where(and(eq(menuItem.businessId, businessId), eq(menuItem.date, date))),
    ]);
    const planMeals = new Map(
      (
        await tx
          .select({ id: pensionPlan.id, meals: pensionPlan.meals })
          .from(pensionPlan)
          .where(eq(pensionPlan.businessId, businessId))
      ).map((p) => [p.id, p.meals]),
    );
    const serviceDay = isServiceDay(date, settings.serviceDays);
    return {
      businessId,
      date,
      today,
      serviceDay,
      serviceDays: settings.serviceDays,
      meals: meals
        .filter((m) => serviceDay && m.active)
        .map((m): KitchenMeal => {
          const diners = subs
            .filter((s) => coversDay(s, date) && (planMeals.get(s.planId) ?? []).includes(m.type))
            .map((s): KitchenDiner => {
              const a = attendance.find((x) => x.residentId === s.residentId && x.meal === m.type) ?? null;
              return {
                residentId: s.residentId,
                name: s.residentName,
                dietNote: s.dietNote,
                state: attendanceState({ paused: isPaused(date, s.pauses), attendance: a }),
                served: a?.served ?? false,
              };
            });
          const item = menu.find((x) => x.meal === m.type);
          return {
            type: m.type,
            startTime: m.startTime,
            deadline: cancelDeadline(date, settings.cancelDeadline),
            menu: item
              ? { dish: item.dish, hasVegetarian: item.hasVegetarian, published: item.status === "published" }
              : null,
            diners,
            counts: kitchenCounts(diners),
          };
        }),
    };
  });
}

export type WeekMenuView = {
  businessId: string;
  // Lunes a domingo de la semana (también los días sin servicio, que se muestran como "No cocinas").
  weekStart: IsoDate;
  days: IsoDate[];
  // Días que la pensión cocina (1 = lunes … 7 = domingo) y hoy en Lima: lo que ya pasó no se mueve ni se edita.
  serviceDays: number[];
  today: IsoDate;
  meals: MealType[];
  // Horario de cada comida activa, por ejemplo "07:00 – 09:00".
  mealTimes: Partial<Record<MealType, string>>;
  entries: { date: IsoDate; meal: MealType; dish: string; hasVegetarian: boolean; published: boolean }[];
};

// Menú de una semana (PN-03), para editarlo.
export async function getWeekMenu(businessId: string, days: IsoDate[]): Promise<WeekMenuView | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    if (!(await pensionBusiness(tx, businessId))) return null;
    const [settings, { meals }, rows] = await Promise.all([
      loadSettings(tx, businessId),
      loadMeals(tx, businessId),
      tx
        .select({
          date: menuItem.date,
          meal: menuItem.meal,
          dish: menuItem.dish,
          hasVegetarian: menuItem.hasVegetarian,
          status: menuItem.status,
        })
        .from(menuItem)
        .where(
          and(eq(menuItem.businessId, businessId), gte(menuItem.date, days[0]), lte(menuItem.date, days[6])),
        ),
    ]);
    const active = meals.filter((m) => m.active);
    return {
      businessId,
      weekStart: days[0],
      days,
      serviceDays: settings.serviceDays,
      today: limaToday(new Date()),
      meals: active.map((m) => m.type),
      mealTimes: Object.fromEntries(active.map((m) => [m.type, `${m.startTime} – ${m.endTime}`])),
      entries: rows.map((r) => ({ ...r, published: r.status === "published" })),
    };
  });
}

export type MyPensionDay = {
  date: IsoDate;
  meals: {
    type: MealType;
    deadline: string;
    // true = canceló; false = viene (por defecto).
    cancelled: boolean;
    served: boolean;
    menu: { dish: string; hasVegetarian: boolean } | null;
  }[];
  paused: boolean;
  // true = ese día la pensión no cocina.
  noService: boolean;
};

export type MyPension = {
  residentId: string;
  businessId: string;
  businessName: string;
  subscription: {
    id: string;
    planName: string;
    planMeals: MealType[];
    dailyPrice: string;
    startDate: IsoDate;
    endDate: IsoDate | null;
    billingCycle: BillingCycle;
    pauses: { id: string; fromDate: IsoDate; toDate: IsoDate }[];
  } | null;
  days: MyPensionDay[];
  // ¿Puede avisar su pago con comprobante? (lo decide la pensión en Configuración)
  acceptsProofs: boolean;
  account: Awaited<ReturnType<typeof loadAccount>>;
};

// "Mi pensión" (PN-05, PN-15, PN-16): los próximos 7 días con sus comidas, el menú publicado y su estado de
// cuenta (pagado hasta, saldo a favor o deuda).
// Una entrada por cada pensión donde la persona tiene ficha (pueden ser de dueños distintos).
export async function getMyPension(): Promise<MyPension[]> {
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return withRls(claims, async (tx) => {
    const [me] = await tx
      .select({ id: person.id })
      .from(person)
      .where(eq(person.userId, claims.sub))
      .limit(1);
    if (!me) return [];
    const cards = await tx
      .select({ id: resident.id, businessId: resident.businessId })
      .from(resident)
      .where(eq(resident.personId, me.id));
    if (!cards.length) return [];
    const subs = await tx
      .select({
        id: pensionSubscription.id,
        residentId: pensionSubscription.residentId,
        planName: pensionPlan.name,
        planMeals: pensionPlan.meals,
        dailyPrice: pensionPlan.dailyPrice,
        startDate: pensionSubscription.startDate,
        endDate: pensionSubscription.endDate,
        billingCycle: pensionSubscription.billingCycle,
      })
      .from(pensionSubscription)
      .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
      .where(
        inArray(
          pensionSubscription.residentId,
          cards.map((c) => c.id),
        ),
      );
    if (!subs.length) return [];
    const names = new Map(
      (
        (await tx.execute(sql`select business_id, trade_name from public.my_payment_info()`)) as unknown as {
          business_id: string;
          trade_name: string;
        }[]
      ).map((b) => [b.business_id, b.trade_name]),
    );
    const out: MyPension[] = [];
    for (const card of cards) {
      const own = subs.filter((s) => s.residentId === card.id);
      if (!own.length) continue;
      // La afiliación que cubre hoy; si no hay, la próxima; si tampoco, la más reciente.
      const sub =
        own.find((s) => coversDay(s, today)) ??
        own.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ??
        own.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const [pauses, settings, { meals }, attendance, menu] = await Promise.all([
        tx
          .select({ id: pensionPause.id, fromDate: pensionPause.fromDate, toDate: pensionPause.toDate })
          .from(pensionPause)
          .where(eq(pensionPause.subscriptionId, sub.id))
          .orderBy(asc(pensionPause.fromDate)),
        loadSettings(tx, card.businessId),
        loadMeals(tx, card.businessId),
        tx
          .select({
            date: mealAttendance.date,
            meal: mealAttendance.meal,
            cancelled: mealAttendance.cancelled,
            served: mealAttendance.served,
          })
          .from(mealAttendance)
          .where(
            and(
              eq(mealAttendance.residentId, card.id),
              gte(mealAttendance.date, days[0]),
              lte(mealAttendance.date, days[6]),
            ),
          ),
        // El RLS solo deja ver el menú publicado.
        tx
          .select({
            date: menuItem.date,
            meal: menuItem.meal,
            dish: menuItem.dish,
            hasVegetarian: menuItem.hasVegetarian,
          })
          .from(menuItem)
          .where(
            and(
              eq(menuItem.businessId, card.businessId),
              gte(menuItem.date, days[0]),
              lte(menuItem.date, days[6]),
            ),
          ),
      ]);
      const active = meals.filter((m) => m.active && sub.planMeals.includes(m.type));
      out.push({
        residentId: card.id,
        businessId: card.businessId,
        businessName: names.get(card.businessId) ?? "Tu pensión",
        subscription: { ...sub, pauses },
        days: days
          .filter((d) => coversDay(sub, d))
          .map((d) => ({
            date: d,
            paused: isPaused(d, pauses),
            noService: !isServiceDay(d, settings.serviceDays),
            meals: (isServiceDay(d, settings.serviceDays) ? active : []).map((m) => {
              const a = attendance.find((x) => x.date === d && x.meal === m.type);
              const item = menu.find((x) => x.date === d && x.meal === m.type);
              return {
                type: m.type,
                deadline: cancelDeadline(d, settings.cancelDeadline),
                cancelled: a?.cancelled ?? false,
                served: a?.served ?? false,
                menu: item ? { dish: item.dish, hasVegetarian: item.hasVegetarian } : null,
              };
            }),
          })),
        acceptsProofs: settings.acceptsPaymentProofs,
        account: await loadAccount(tx, { ...sub, residentId: card.id }, pauses, settings, today),
      });
    }
    return out;
  });
}

// ¿La persona con sesión come en alguna pensión? Para mostrar "Pensión" en su menú.
export async function hasMyPension(): Promise<boolean> {
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const rows = await tx
      .select({ id: pensionSubscription.id })
      .from(pensionSubscription)
      .innerJoin(resident, eq(resident.id, pensionSubscription.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(person.userId, claims.sub))
      .limit(1);
    return rows.length > 0;
  });
}

type Account = Awaited<ReturnType<typeof loadAccount>>;

// La afiliación que importa hoy: la que cubre hoy; si no hay, la próxima; si tampoco, la más reciente.
function currentOf<T extends { startDate: IsoDate; endDate: IsoDate | null }>(subs: T[], today: IsoDate) {
  return (
    subs.find((s) => coversDay(s, today)) ??
    subs.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ??
    [...subs].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ??
    null
  );
}

export type DinerRow = {
  residentId: string;
  name: string;
  phone: string | null;
  email: string | null;
  hasAccount: boolean;
  subscription:
    | (SubscriptionRow & {
        billingCycle: BillingCycle;
        account: Omit<Account, "payments">;
      })
    | null;
};

// Comensales de una pensión (PN-04, PN-09) con su afiliación de hoy y su estado de cuenta (cobro por adelantado).
export async function listDiners(businessId: string): Promise<{ today: IsoDate; diners: DinerRow[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    if (!(await pensionBusiness(tx, businessId))) return null;
    const [settings, people, subs, details] = await Promise.all([
      loadSettings(tx, businessId),
      tx
        .select({
          residentId: resident.id,
          name: person.fullName,
          phone: person.phone,
          email: person.email,
          userId: person.userId,
        })
        .from(resident)
        .innerJoin(person, eq(person.id, resident.personId))
        .where(eq(resident.businessId, businessId))
        .orderBy(asc(person.fullName)),
      loadSubscriptions(tx, businessId, today),
      tx
        .select({
          id: pensionSubscription.id,
          billingCycle: pensionSubscription.billingCycle,
          dailyPrice: pensionPlan.dailyPrice,
          planMeals: pensionPlan.meals,
        })
        .from(pensionSubscription)
        .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
        .where(eq(pensionPlan.businessId, businessId)),
    ]);
    const diners: DinerRow[] = [];
    for (const p of people) {
      const sub = currentOf(
        subs.filter((s) => s.residentId === p.residentId),
        today,
      );
      const d = sub ? details.find((x) => x.id === sub.id) : undefined;
      let subscription: DinerRow["subscription"] = null;
      if (sub && d) {
        const full = await loadAccount(tx, { ...sub, ...d }, sub.pauses, settings, today);
        subscription = {
          ...sub,
          billingCycle: d.billingCycle,
          account: {
            paidUntil: full.paidUntil,
            balance: full.balance,
            upToDate: full.upToDate,
            partial: full.partial,
            next: full.next,
          },
        };
      }
      diners.push({
        residentId: p.residentId,
        name: p.name,
        phone: p.phone,
        email: p.email,
        hasAccount: p.userId !== null,
        subscription,
      });
    }
    return { today, diners };
  });
}

export type DinerDetail = {
  businessId: string;
  today: IsoDate;
  residentId: string;
  name: string;
  phone: string | null;
  email: string | null;
  hasAccount: boolean;
  // Todas sus afiliaciones, de la más reciente a la más antigua.
  subscriptions: (SubscriptionRow & { billingCycle: BillingCycle })[];
  current: (SubscriptionRow & { billingCycle: BillingCycle; dailyPrice: string; account: Account }) | null;
  // Planes que se le pueden ofrecer (activos) más el suyo aunque esté desactivado.
  plans: { id: string; name: string; dailyPrice: string; active: boolean }[];
};

// Página de un comensal: sus datos, su plan, sus pausas y sus pagos.
export async function getDiner(businessId: string, residentId: string): Promise<DinerDetail | null> {
  if (!isUuid(businessId) || !isUuid(residentId)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    if (!(await pensionBusiness(tx, businessId))) return null;
    const [p] = await tx
      .select({ name: person.fullName, phone: person.phone, email: person.email, userId: person.userId })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .where(and(eq(resident.id, residentId), eq(resident.businessId, businessId)))
      .limit(1);
    if (!p) return null;
    const [settings, all, details, plans] = await Promise.all([
      loadSettings(tx, businessId),
      loadSubscriptions(tx, businessId, today),
      tx
        .select({
          id: pensionSubscription.id,
          billingCycle: pensionSubscription.billingCycle,
          dailyPrice: pensionPlan.dailyPrice,
          planMeals: pensionPlan.meals,
        })
        .from(pensionSubscription)
        .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
        .where(eq(pensionSubscription.residentId, residentId)),
      tx
        .select({
          id: pensionPlan.id,
          name: pensionPlan.name,
          dailyPrice: pensionPlan.dailyPrice,
          active: pensionPlan.active,
        })
        .from(pensionPlan)
        .where(eq(pensionPlan.businessId, businessId))
        .orderBy(asc(pensionPlan.name)),
    ]);
    const subscriptions = all
      .filter((s) => s.residentId === residentId)
      .map((s) => ({ ...s, billingCycle: details.find((d) => d.id === s.id)!.billingCycle }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const sub = currentOf(subscriptions, today);
    const d = sub ? details.find((x) => x.id === sub.id)! : null;
    return {
      businessId,
      today,
      residentId,
      name: p.name,
      phone: p.phone,
      email: p.email,
      hasAccount: p.userId !== null,
      subscriptions,
      current:
        sub && d
          ? {
              ...sub,
              dailyPrice: d.dailyPrice,
              account: await loadAccount(tx, { ...sub, ...d }, sub.pauses, settings, today),
            }
          : null,
      plans: plans.filter((x) => x.active || x.id === sub?.planId),
    };
  });
}

export type PensionPaymentRow = {
  id: string;
  residentId: string;
  name: string;
  amount: string;
  method: (typeof pensionPayment.$inferSelect)["method"];
  paidOn: IsoDate;
  coversFrom: IsoDate;
  coversTo: IsoDate;
  note: string | null;
  status: (typeof pensionPayment.$inferSelect)["status"];
  operationCode: string | null;
  hasProof: boolean;
  rejectionReason: string | null;
};

// Pantalla Pagos: todos los comprobantes por revisar y los últimos pagos revisados.
export async function listPensionPayments(
  businessId: string,
  limit = 50,
): Promise<{ pending: PensionPaymentRow[]; recent: PensionPaymentRow[] }> {
  if (!isUuid(businessId)) return { pending: [], recent: [] };
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const base = () =>
      tx
        .select({
          id: pensionPayment.id,
          residentId: resident.id,
          name: person.fullName,
          amount: pensionPayment.amount,
          method: pensionPayment.method,
          paidOn: pensionPayment.paidOn,
          coversFrom: pensionPayment.coversFrom,
          coversTo: pensionPayment.coversTo,
          note: pensionPayment.note,
          status: pensionPayment.status,
          operationCode: pensionPayment.operationCode,
          hasProof: sql<boolean>`${pensionPayment.proofPath} is not null`,
          rejectionReason: pensionPayment.rejectionReason,
        })
        .from(pensionPayment)
        .innerJoin(pensionSubscription, eq(pensionSubscription.id, pensionPayment.subscriptionId))
        .innerJoin(resident, eq(resident.id, pensionSubscription.residentId))
        .innerJoin(person, eq(person.id, resident.personId));
    const [pending, recent] = await Promise.all([
      base()
        .where(and(eq(resident.businessId, businessId), eq(pensionPayment.status, "in_review")))
        .orderBy(asc(pensionPayment.createdAt)),
      base()
        .where(and(eq(resident.businessId, businessId), ne(pensionPayment.status, "in_review")))
        .orderBy(desc(pensionPayment.paidOn), desc(pensionPayment.createdAt))
        .limit(limit),
    ]);
    return { pending, recent };
  });
}
