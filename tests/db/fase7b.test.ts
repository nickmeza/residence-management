import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";

// Fase 7, segunda parte, contra la base real con RLS activo: mensajes, reseñas (anónimas de verdad), paquetes,
// pedidos de limpieza (solo si el negocio los prende) y tareas que se repiten. Necesita la migración 0025 aplicada.
// Cada prueba deshace todo.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const LANDLORD = "00000000-0000-4000-8000-0000000007b1";
const RESIDENT = "00000000-0000-4000-8000-0000000007b2";
const OTHER = "00000000-0000-4000-8000-0000000007b3";

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];
const one = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await rows<T>(tx, query))[0];

// Una consulta que el RLS debe rechazar, en un punto de guardado para no romper la transacción de la prueba.
const rejects = (tx: Tx, query: ReturnType<typeof sql>) =>
  expect(tx.transaction((sp) => sp.execute(query))).rejects.toThrow();

class Rollback extends Error {}

type Ctx = { businessId: string; residentId: string; contractId: string; unitId: string };

// Una residencia con un cuarto y un residente con contrato confirmado (sin fecha de fin) desde hace un mes.
async function withResidence(fn: (tx: Tx, ctx: Ctx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${LANDLORD}, 'f7b1@prueba.test', '{"full_name":"Arrendador Ocho"}', 'authenticated', 'authenticated'),
        (${RESIDENT}, 'f7b2@prueba.test', '{"full_name":"Residente Ocho"}', 'authenticated', 'authenticated'),
        (${OTHER}, 'f7b3@prueba.test', '{"full_name":"Otro Ocho"}', 'authenticated', 'authenticated')`);
      const b = await one<{ id: string }>(
        tx,
        sql`insert into public.business (owner_id, service, kind, trade_name)
          select id, 'residence', 'natural', 'Residencia Ocho' from public.person where user_id = ${LANDLORD}
          returning id`,
      );
      const p = await one<{ id: string }>(
        tx,
        sql`insert into public.property (business_id, name, address, district_city, type)
          values (${b.id}, 'Edificio Ocho', 'Calle 8', 'Lima', 'building') returning id`,
      );
      const f = await one<{ id: string }>(
        tx,
        sql`insert into public.floor (property_id, level, outline)
          values (${p.id}, 1, '[{"x":0,"z":0},{"x":10,"z":0},{"x":10,"z":8},{"x":0,"z":8}]') returning id`,
      );
      const u = await one<{ id: string }>(
        tx,
        sql`insert into public.unit (floor_id, type, name, monthly_price, pos_x, pos_z, width, depth)
          values (${f.id}, 'room', '101', 650, 0, 0, 3, 3) returning id`,
      );
      const r = await one<{ id: string }>(
        tx,
        sql`insert into public.resident (business_id, person_id)
          select ${b.id}, id from public.person where user_id = ${RESIDENT} returning id`,
      );
      const c = await one<{ id: string }>(
        tx,
        sql`insert into public.contract (unit_id, resident_id, start_date, monthly_rent, payment_day, paperwork,
            status, confirmed_at)
          values (${u.id}, ${r.id}, current_date - 30, 650, 5, 'none', 'confirmed', now()) returning id`,
      );
      await fn(tx, { businessId: b.id, residentId: r.id, contractId: c.id, unitId: u.id });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const personOf = (uid: string) => sql`(select id from public.person where user_id = ${uid})`;

describe("mensajes (Fase 7.8)", () => {
  it("el residente y el arrendador se escriben; nadie más lo ve", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, RESIDENT);
      await tx.execute(sql`insert into public.message (resident_id, author_id, from_resident, body)
        values (${ctx.residentId}, ${personOf(RESIDENT)}, true, 'Hola, ¿hay agua caliente?')`);
      // No puede hacerse pasar por la residencia.
      await rejects(
        tx,
        sql`insert into public.message (resident_id, author_id, from_resident, body)
          values (${ctx.residentId}, ${personOf(RESIDENT)}, false, 'Soy la residencia')`,
      );
      await actAs(tx, LANDLORD);
      await tx.execute(sql`insert into public.message (resident_id, author_id, from_resident, body)
        values (${ctx.residentId}, ${personOf(LANDLORD)}, false, 'Sí, desde las 6 a. m.')`);
      expect(await rows(tx, sql`select id from public.message`)).toHaveLength(2);
      await actAs(tx, OTHER);
      expect(await rows(tx, sql`select id from public.message`)).toEqual([]);
      await rejects(
        tx,
        sql`insert into public.message (resident_id, author_id, from_resident, body)
          values (${ctx.residentId}, ${personOf(OTHER)}, true, 'Intruso')`,
      );
    }));

  it("el residente marca como leído lo de su residencia, pero no puede cambiar el texto", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, LANDLORD);
      await tx.execute(sql`insert into public.message (resident_id, author_id, from_resident, body)
        values (${ctx.residentId}, ${personOf(LANDLORD)}, false, 'Mañana fumigan')`);
      await actAs(tx, RESIDENT);
      const changed = await rows(tx, sql`update public.message set body = 'Cambiado' returning id`);
      expect(changed).toEqual([]);
      expect(
        await one<{ n: number }>(tx, sql`select public.read_my_messages(${ctx.residentId}::uuid) as n`),
      ).toEqual({
        n: 1,
      });
      await actAs(tx, OTHER);
      expect(
        await one<{ n: number }>(tx, sql`select public.read_my_messages(${ctx.residentId}::uuid) as n`),
      ).toEqual({
        n: 0,
      });
    }));
});

describe("reseñas (Fase 7.9)", () => {
  const insertReview = (ctx: Ctx, anonymous: boolean) =>
    sql`insert into public.review (contract_id, resident_id, business_id, room, cleaning, treatment, coexistence,
        recommends, anonymous, comment)
      values (${ctx.contractId}, ${ctx.residentId}, ${ctx.businessId}, 5, 4, 5, 4, true, ${anonymous}, 'Todo bien')`;

  it("solo se califica un contrato que terminó, una vez, y el anónimo no muestra el nombre", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, RESIDENT);
      // El contrato sigue vigente (sin fecha de fin).
      await rejects(tx, insertReview(ctx, true));
      await actAs(tx, LANDLORD);
      await tx.execute(
        sql`update public.contract set end_date = current_date - 1 where id = ${ctx.contractId}`,
      );
      await actAs(tx, RESIDENT);
      await tx.execute(insertReview(ctx, true));
      await rejects(tx, insertReview(ctx, false));
      await actAs(tx, LANDLORD);
      // El arrendador no lee la tabla directo…
      expect(await rows(tx, sql`select id from public.review`)).toEqual([]);
      // …sino con la función, que quita el nombre y la unidad.
      const [r] = await rows<{ resident_name: string | null; unit_name: string | null; comment: string }>(
        tx,
        sql`select * from public.business_reviews(${ctx.businessId}::uuid)`,
      );
      expect(r).toMatchObject({ resident_name: null, unit_name: null, comment: "Todo bien" });
      await actAs(tx, OTHER);
      expect(await rows(tx, sql`select * from public.business_reviews(${ctx.businessId}::uuid)`)).toEqual([]);
    }));
});

describe("paquetes, limpieza y tareas (Fase 7.10 a 7.13)", () => {
  it("el residente ve solo sus paquetes", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, LANDLORD);
      await tx.execute(sql`insert into public.parcel (business_id, resident_id, description, created_by)
        values (${ctx.businessId}, ${ctx.residentId}, 'Caja mediana', ${personOf(LANDLORD)})`);
      await actAs(tx, RESIDENT);
      expect(await rows(tx, sql`select description from public.parcel`)).toEqual([
        { description: "Caja mediana" },
      ]);
      await actAs(tx, OTHER);
      expect(await rows(tx, sql`select id from public.parcel`)).toEqual([]);
    }));

  it("el residente pide limpieza solo si su residencia lo prendió", () =>
    withResidence(async (tx, ctx) => {
      const ask = sql`insert into public.cleaning_request (business_id, resident_id, unit_id)
        values (${ctx.businessId}, ${ctx.residentId}, ${ctx.unitId})`;
      await actAs(tx, RESIDENT);
      await rejects(tx, ask);
      await actAs(tx, LANDLORD);
      await tx.execute(
        sql`update public.business set accepts_cleaning_requests = true where id = ${ctx.businessId}`,
      );
      await actAs(tx, RESIDENT);
      await tx.execute(ask);
      // No puede ponerse la fecha él mismo.
      await rejects(
        tx,
        sql`insert into public.cleaning_request (business_id, resident_id, status, scheduled_for)
          values (${ctx.businessId}, ${ctx.residentId}, 'scheduled', current_date)`,
      );
      expect(await rows(tx, sql`select id from public.cleaning_request`)).toHaveLength(1);
    }));

  it("las tareas y los proveedores son solo del arrendador", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, LANDLORD);
      await tx.execute(
        sql`insert into public.supplier (business_id, name) values (${ctx.businessId}, 'Gasfitero')`,
      );
      await tx.execute(sql`insert into public.recurring_task (business_id, kind, title, every, period, next_due)
        values (${ctx.businessId}, 'cleaning', 'Pasillo', 1, 'week', current_date)`);
      for (const uid of [RESIDENT, OTHER]) {
        await actAs(tx, uid);
        expect(await rows(tx, sql`select id from public.recurring_task`)).toEqual([]);
        expect(await rows(tx, sql`select id from public.supplier`)).toEqual([]);
      }
    }));
});
