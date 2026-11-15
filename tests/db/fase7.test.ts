import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { createAsResident, MaintenanceError, updateRequest } from "@/server/maintenance/mutations";

// Fase 7 contra la base real, con RLS activo: notificaciones (solo dentro de un mismo negocio) y mantenimiento (el
// residente pide solo a su nombre). Necesita las migraciones 0020 a 0024 aplicadas. Cada prueba deshace todo.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const LANDLORD = "00000000-0000-4000-8000-0000000007a1";
const RESIDENT = "00000000-0000-4000-8000-0000000007a2";
const OTHER = "00000000-0000-4000-8000-0000000007a3";

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];
const one = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await rows<T>(tx, query))[0];

class Rollback extends Error {}

type Ctx = { businessId: string; residentId: string; contractId: string; unitId: string };

// Una residencia con un piso, un cuarto y un residente con contrato confirmado desde hace un mes.
async function withResidence(fn: (tx: Tx, ctx: Ctx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${LANDLORD}, 'f7a@prueba.test', '{"full_name":"Arrendador Siete"}', 'authenticated', 'authenticated'),
        (${RESIDENT}, 'f7b@prueba.test', '{"full_name":"Residente Siete"}', 'authenticated', 'authenticated'),
        (${OTHER}, 'f7c@prueba.test', '{"full_name":"Otro Siete"}', 'authenticated', 'authenticated')`);
      const b = await one<{ id: string }>(
        tx,
        sql`insert into public.business (owner_id, service, kind, trade_name)
          select id, 'residence', 'natural', 'Residencia Siete' from public.person where user_id = ${LANDLORD}
          returning id`,
      );
      const p = await one<{ id: string }>(
        tx,
        sql`insert into public.property (business_id, name, address, district_city, type)
          values (${b.id}, 'Edificio Siete', 'Calle 7', 'Lima', 'building') returning id`,
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

const notifyResident = (tx: Tx, residentId: string) =>
  one<{ ok: boolean }>(
    tx,
    sql`select public.notify_resident(${residentId}::uuid, 'announcement', 'Corte de agua', null, '/mi/avisos', false) as ok`,
  ).then((r) => r.ok);

const notifyOwner = (tx: Tx, businessId: string) =>
  one<{ ok: boolean }>(
    tx,
    sql`select public.notify_owner(${businessId}::uuid, 'payment_proof', 'Mandó un comprobante', null, '/cobros', true) as ok`,
  ).then((r) => r.ok);

const myNotifications = (tx: Tx) => rows<{ title: string }>(tx, sql`select title from public.notification`);

describe("notificaciones (Fase 7.1)", () => {
  it("el arrendador avisa a su residente y solo él la ve", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, LANDLORD);
      expect(await notifyResident(tx, ctx.residentId)).toBe(true);
      expect(await myNotifications(tx)).toEqual([]);
      await actAs(tx, RESIDENT);
      expect((await myNotifications(tx)).map((n) => n.title)).toEqual(["Corte de agua"]);
      await actAs(tx, OTHER);
      expect(await myNotifications(tx)).toEqual([]);
    }));

  it("el residente avisa al dueño de su negocio; alguien de fuera no puede", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, RESIDENT);
      expect(await notifyOwner(tx, ctx.businessId)).toBe(true);
      await actAs(tx, OTHER);
      expect(await notifyOwner(tx, ctx.businessId)).toBe(false);
      expect(await notifyResident(tx, ctx.residentId)).toBe(false);
      await actAs(tx, LANDLORD);
      expect((await myNotifications(tx)).map((n) => n.title)).toEqual(["Mandó un comprobante"]);
    }));

  it("nadie inserta notificaciones directo en la tabla", () =>
    withResidence(async (tx) => {
      await actAs(tx, RESIDENT);
      await expect(
        tx.transaction((sp) =>
          sp.execute(sql`insert into public.notification (person_id, type, title)
            select id, 'x', 'Falsa' from public.person where user_id = ${RESIDENT}`),
        ),
      ).rejects.toThrow();
    }));
});

describe("mantenimiento (Fase 7.2)", () => {
  it("el residente pide desde su contrato; el arrendador lo ve y le avisa al cambiar el estado", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, RESIDENT);
      const id = await createAsResident(
        tx,
        {
          residentId: ctx.residentId,
          contractId: ctx.contractId,
          title: "La terma no calienta",
          description: null,
          category: "appliance",
          priority: "urgent",
          photoPath: null,
        },
        RESIDENT,
      );
      await actAs(tx, OTHER);
      expect(await rows(tx, sql`select id from public.maintenance_request`)).toEqual([]);
      await actAs(tx, LANDLORD);
      const [req] = await rows<{ unit_id: string; status: string }>(
        tx,
        sql`select unit_id, status from public.maintenance_request where id = ${id}`,
      );
      expect(req).toEqual({ unit_id: ctx.unitId, status: "open" });
      expect((await myNotifications(tx)).length).toBe(1);
      await updateRequest(tx, id, {
        status: "done",
        priority: "urgent",
        assignee: "Gasfitero",
        cost: "80",
        blocksUnit: false,
      });
      // Un pedido resuelto no se vuelve a abrir.
      await expect(
        updateRequest(tx, id, {
          status: "open",
          priority: "urgent",
          assignee: null,
          cost: null,
          blocksUnit: false,
        }),
      ).rejects.toBeInstanceOf(MaintenanceError);
      await actAs(tx, RESIDENT);
      expect((await myNotifications(tx)).map((n) => n.title)).toEqual([
        "Tu pedido de mantenimiento: Resuelto",
      ]);
    }));

  it("el residente no puede crear un pedido ya resuelto ni con costo", () =>
    withResidence(async (tx, ctx) => {
      await actAs(tx, RESIDENT);
      await expect(
        tx.transaction((sp) =>
          sp.execute(sql`insert into public.maintenance_request (business_id, unit_id, resident_id, title, status,
              resolved_at, reported_by)
            select ${ctx.businessId}, ${ctx.unitId}, ${ctx.residentId}, 'Truco', 'done', now(), id
            from public.person where user_id = ${RESIDENT}`),
        ),
      ).rejects.toThrow();
    }));
});
