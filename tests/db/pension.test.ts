import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { deletePlan, PensionError, savePensionSettings, savePlan } from "@/server/pension/mutations";

// Pensión (Fase 6) contra la base real, con RLS activo: las funciones del comensal (confirmar y pausar) y quién
// ve qué. Cada prueba deshace todo. Las fechas se calculan desde "hoy en Lima" para no depender del reloj.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const LANDLORD = "00000000-0000-4000-8000-0000000000f1";
const DINER = "00000000-0000-4000-8000-0000000000f2";
const OTHER = "00000000-0000-4000-8000-0000000000f3";

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];
const one = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await rows<T>(tx, query))[0];

// Un día relativo a hoy en Lima, como texto AAAA-MM-DD.
const day = (tx: Tx, offset: number) =>
  one<{ d: string }>(
    tx,
    sql`select ((now() at time zone 'America/Lima')::date + ${offset}::int)::text as d`,
  ).then((r) => r.d);

const cancel = (tx: Tx, residentId: string, date: string, meal: string, yes: boolean) =>
  one<{ r: string }>(
    tx,
    sql`select public.cancel_my_meal(${residentId}::uuid, ${date}::date, ${meal}::public.meal_type, ${yes}) as r`,
  ).then((x) => x.r);

const pause = (tx: Tx, subId: string, from: string, to: string) =>
  one<{ r: string }>(
    tx,
    sql`select public.pause_my_pension(${subId}::uuid, ${from}::date, ${to}::date) as r`,
  ).then((x) => x.r);

class Rollback extends Error {}

type Ctx = { businessId: string; residentId: string; subId: string; planId: string };

// Una pensión del arrendador con almuerzo (12:30) y cena (19:00), hora límite de cancelación 20:00 del día anterior, un plan con las dos y un comensal
// afiliado desde hace 5 días. Se crea como administrador de la base y la prueba corre después con la sesión que elija.
async function withPension(fn: (tx: Tx, ctx: Ctx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${LANDLORD}, 'p1@prueba.test', '{"full_name":"Arrendador P"}', 'authenticated', 'authenticated'),
        (${DINER}, 'p2@prueba.test', '{"full_name":"Comensal P"}', 'authenticated', 'authenticated'),
        (${OTHER}, 'p3@prueba.test', '{"full_name":"Otro P"}', 'authenticated', 'authenticated')`);
      const b = await one<{ id: string }>(
        tx,
        sql`insert into public.business (owner_id, service, kind, trade_name)
          select id, 'meal_plan', 'natural', 'Pensión P' from public.person where user_id = ${LANDLORD} returning id`,
      );
      await tx.execute(sql`insert into public.meal (business_id, type, start_time, end_time, single_price) values
        (${b.id}, 'lunch', '12:30', '14:30', 11), (${b.id}, 'dinner', '19:00', '21:00', 8)`);
      await tx.execute(
        sql`insert into public.meal_settings (business_id, cancel_deadline) values (${b.id}, '20:00')`,
      );
      const plan = await one<{ id: string }>(
        tx,
        sql`insert into public.pension_plan (business_id, name, meals, daily_price)
          values (${b.id}, 'Almuerzo y cena', '{lunch,dinner}', 17) returning id`,
      );
      const r = await one<{ id: string }>(
        tx,
        sql`insert into public.resident (business_id, person_id)
          select ${b.id}, id from public.person where user_id = ${DINER} returning id`,
      );
      const start = await day(tx, -5);
      const sub = await one<{ id: string }>(
        tx,
        sql`insert into public.pension_subscription (resident_id, plan_id, start_date)
          values (${r.id}, ${plan.id}, ${start}) returning id`,
      );
      await fn(tx, { businessId: b.id, residentId: r.id, subId: sub.id, planId: plan.id });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

describe("cancelación (regla 12: por defecto se cocina; se cancela hasta el día anterior)", () => {
  it("el comensal cancela y vuelve a pedir antes de la hora límite", async () => {
    await withPension(async (tx, c) => {
      const date = await day(tx, 2);
      const row = () =>
        rows<{ cancelled: boolean }>(
          tx,
          sql`select cancelled from public.meal_attendance where resident_id = ${c.residentId} and date = ${date}`,
        );
      await actAs(tx, DINER);
      expect(await cancel(tx, c.residentId, date, "lunch", true)).toBe("ok");
      expect((await row())[0].cancelled).toBe(true);
      // Volver a pedirla borra la fila: sin fila = viene.
      expect(await cancel(tx, c.residentId, date, "lunch", false)).toBe("ok");
      expect(await row()).toEqual([]);
    });
  });

  it("para hoy ya cerró (la hora límite fue ayer); ni comidas fuera de su plan; ni la ficha de otro", async () => {
    await withPension(async (tx, c) => {
      await actAs(tx, DINER);
      expect(await cancel(tx, c.residentId, await day(tx, 0), "lunch", true)).toBe("closed");
      expect(await cancel(tx, c.residentId, await day(tx, -1), "lunch", true)).toBe("closed");
      expect(await cancel(tx, c.residentId, await day(tx, 2), "breakfast", true)).toBe("no_plan");
      await actAs(tx, OTHER);
      expect(await cancel(tx, c.residentId, await day(tx, 2), "lunch", true)).toBe("not_found");
    });
  });

  it("el comensal no puede escribir la asistencia directo (solo por la función)", async () => {
    await withPension(async (tx, c) => {
      const date = await day(tx, 2);
      await actAs(tx, DINER);
      await expect(
        tx.transaction((sp) =>
          sp.execute(sql`insert into public.meal_attendance (resident_id, date, meal, cancelled, served)
            values (${c.residentId}, ${date}, 'lunch', false, true)`),
        ),
      ).rejects.toThrow();
    });
  });
});

describe("pausas (los días pausados no se cobran ni se cocinan)", () => {
  it("pausa unos días: borra sus cancelaciones y no deja cancelar ahí", async () => {
    await withPension(async (tx, c) => {
      const [d3, d4, d5] = [await day(tx, 3), await day(tx, 4), await day(tx, 5)];
      await actAs(tx, DINER);
      expect(await cancel(tx, c.residentId, d4, "lunch", true)).toBe("ok");
      expect(await pause(tx, c.subId, d3, d5)).toBe("ok");
      const left = await one<{ n: number }>(
        tx,
        sql`select count(*)::int as n from public.meal_attendance where resident_id = ${c.residentId}`,
      );
      expect(left.n).toBe(0);
      expect(await cancel(tx, c.residentId, d4, "dinner", true)).toBe("paused");
      expect(await pause(tx, c.subId, d4, await day(tx, 6))).toBe("overlap");
      expect(await pause(tx, c.subId, await day(tx, -2), d3)).toBe("invalid");
    });
  });

  it("no se puede pausar un día en que ya comió", async () => {
    await withPension(async (tx, c) => {
      const d10 = await day(tx, 10);
      await actAs(tx, LANDLORD);
      await tx.execute(sql`insert into public.meal_attendance (resident_id, date, meal, served)
        values (${c.residentId}, ${d10}, 'lunch', true)`);
      await actAs(tx, DINER);
      expect(await pause(tx, c.subId, await day(tx, 9), await day(tx, 11))).toBe("served");
    });
  });
});

describe("pagos por adelantado", () => {
  it("la cocina registra el pago; el comensal lo ve pero no puede registrarlo; queda en la bitácora", async () => {
    await withPension(async (tx, c) => {
      const [from, to] = [await day(tx, 0), await day(tx, 6)];
      await actAs(tx, LANDLORD);
      const pay = await one<{ id: string }>(
        tx,
        sql`insert into public.pension_payment (subscription_id, amount, method, paid_on, covers_from, covers_to, registered_by)
          select ${c.subId}, 119, 'yape', ${from}, ${from}, ${to}, id from public.person where user_id = ${LANDLORD}
          returning id`,
      );
      await actAs(tx, DINER);
      expect((await rows(tx, sql`select 1 from public.pension_payment`)).length).toBe(1);
      await expect(
        tx.transaction((sp) =>
          sp.execute(sql`insert into public.pension_payment (subscription_id, amount, method, paid_on, covers_from, covers_to, registered_by)
            select ${c.subId}, 1, 'cash', ${from}, ${from}, ${from}, id from public.person where user_id = ${DINER}`),
        ),
      ).rejects.toThrow();
      await actAs(tx, OTHER);
      expect((await rows(tx, sql`select 1 from public.pension_payment`)).length).toBe(0);
      await tx.execute(sql`reset role`);
      const logged = await one<{ n: number }>(
        tx,
        sql`select count(*)::int as n from public.money_log where table_name = 'pension_payment' and row_id = ${pay.id}`,
      );
      expect(logged.n).toBe(1);
    });
  });
});

describe("quién ve qué", () => {
  it("el comensal solo ve el menú publicado; otro arrendador no ve nada", async () => {
    await withPension(async (tx, c) => {
      const date = await day(tx, 1);
      await tx.execute(sql`insert into public.menu_item (business_id, date, meal, dish, status) values
        (${c.businessId}, ${date}, 'lunch', 'Ají de gallina', 'published'),
        (${c.businessId}, ${date}, 'dinner', 'Sopa', 'draft')`);
      await actAs(tx, DINER);
      const seen = await rows<{ dish: string }>(tx, sql`select dish from public.menu_item`);
      expect(seen.map((r) => r.dish)).toEqual(["Ají de gallina"]);
      expect((await rows(tx, sql`select 1 from public.pension_plan`)).length).toBe(1);
      await actAs(tx, OTHER);
      for (const table of [
        "menu_item",
        "meal",
        "pension_plan",
        "pension_subscription",
        "meal_settings",
        "pension_payment",
      ]) {
        expect((await rows(tx, sql`select 1 from ${sql.raw(`public.${table}`)}`)).length).toBe(0);
      }
    });
  });

  it("una afiliación no puede usar el plan de otro negocio", async () => {
    await withPension(async (tx, c) => {
      const other = await one<{ id: string }>(
        tx,
        sql`insert into public.business (owner_id, service, kind, trade_name)
          select id, 'meal_plan', 'natural', 'Otra pensión' from public.person where user_id = ${OTHER} returning id`,
      );
      const foreign = await one<{ id: string }>(
        tx,
        sql`insert into public.pension_plan (business_id, name, meals, daily_price)
          values (${other.id}, 'Ajeno', '{lunch}', 10) returning id`,
      );
      await expect(
        tx.transaction((sp) =>
          sp.execute(sql`insert into public.pension_subscription (resident_id, plan_id, start_date)
            values (${c.residentId}, ${foreign.id}, current_date)`),
        ),
      ).rejects.toThrow();
    });
  });
});

describe("configuración de la pensión", () => {
  const settings = {
    cancelDeadline: "21:00",
    serviceModes: ["takeaway" as const, "delivery" as const],
    seatsPerTurn: null,
    acceptsExternal: true,
    diets: ["vegetariano", "vegetariano"],
    meals: [
      { type: "breakfast" as const, active: false, startTime: "07:00", endTime: "09:00", singlePrice: "5" },
      { type: "lunch" as const, active: true, startTime: "13:00", endTime: "15:00", singlePrice: "12" },
      { type: "dinner" as const, active: true, startTime: "19:00", endTime: "21:00", singlePrice: "8" },
    ],
  };

  it("la dueña guarda sus comidas y su hora de cancelación; otro arrendador no puede", async () => {
    await withPension(async (tx, c) => {
      await actAs(tx, LANDLORD);
      await savePensionSettings(tx, c.businessId, settings);
      const s = await one<{ cancel_deadline: string; diets: string[] }>(
        tx,
        sql`select cancel_deadline::text, diets from public.meal_settings where business_id = ${c.businessId}`,
      );
      expect(s.cancel_deadline).toBe("21:00:00");
      expect(s.diets).toEqual(["vegetariano"]);
      const meals = await rows<{ type: string; active: boolean }>(
        tx,
        sql`select type, active from public.meal where business_id = ${c.businessId} order by type`,
      );
      expect(meals).toEqual([
        { type: "breakfast", active: false },
        { type: "lunch", active: true },
        { type: "dinner", active: true },
      ]);
      await actAs(tx, OTHER);
      await expect(savePensionSettings(tx, c.businessId, settings)).rejects.toThrow(PensionError);
    });
  });

  it("un plan con comensales no se borra; uno sin comensales sí", async () => {
    await withPension(async (tx, c) => {
      await actAs(tx, LANDLORD);
      await expect(deletePlan(tx, c.businessId, c.planId)).rejects.toThrow(/desactívalo/);
      await savePlan(tx, c.businessId, null, {
        name: "Solo almuerzo",
        meals: ["lunch"],
        dailyPrice: "11",
        active: true,
      });
      const plan = await one<{ id: string }>(
        tx,
        sql`select id from public.pension_plan where name = 'Solo almuerzo'`,
      );
      await deletePlan(tx, c.businessId, plan.id);
      expect((await rows(tx, sql`select 1 from public.pension_plan`)).length).toBe(1);
    });
  });
});
