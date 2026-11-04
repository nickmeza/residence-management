import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as m from "@/server/building/mutations";
import { insertSetup } from "@/server/onboarding/save";
import { setupSchema } from "@/server/onboarding/schema";

// Cambios al edificio (pantalla Edificio) contra la base real, como una cuenta con sesión (RLS activo).
// Cada prueba deshace todo al final.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000000d1";
const B = "00000000-0000-4000-8000-0000000000d2";

const business = {
  kind: "natural",
  tradeName: "Residencia D",
  legalName: "",
  ruc: "",
  phone: "",
  contactEmail: "",
  city: "",
  address: "",
  paymentMethods: ["yape"],
  billingDay: "5",
};
const unit = (over: Record<string, unknown>) => ({
  key: "u",
  type: "room",
  name: "Cuarto",
  monthlyPrice: "",
  areaM2: "",
  occupiesWholeFloor: false,
  rentalMode: "whole",
  rooms: [],
  ...over,
});
const setup = setupSchema.parse({
  services: { residence: true, mealPlan: false },
  residenceBusiness: business,
  property: {
    type: "building",
    ownerLivesHere: "yes",
    name: "Edificio D",
    address: "Calle Ejemplo 1",
    districtCity: "Lima",
    floors: [
      { units: [unit({ key: "a", name: "Cuarto 101", monthlyPrice: "500" })] },
      {
        units: [
          unit({
            key: "d",
            type: "apartment",
            name: "Departamento 201",
            monthlyPrice: "1500",
            rooms: [{ key: "d1", name: "Dormitorio 1", monthlyPrice: "", areaM2: "" }],
          }),
        ],
      },
    ],
  },
});

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];

class Rollback extends Error {}

// Arma el edificio de A dentro de una transacción que siempre se deshace.
async function withBuilding(
  fn: (tx: Tx, ids: { propertyId: string; unitId: (name: string) => Promise<string> }) => Promise<void>,
) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'd1@prueba.test', '{"full_name":"A"}', 'authenticated', 'authenticated'),
        (${B}, 'd2@prueba.test', '{"full_name":"B"}', 'authenticated', 'authenticated')`);
      await actAs(tx, A);
      const [me] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${A}`);
      await insertSetup(tx, me.id, setup);
      const [p] = await rows<{ id: string }>(tx, sql`select id from public.property`);
      const unitId = async (name: string) =>
        (await rows<{ id: string }>(tx, sql`select id from public.unit where name = ${name}`))[0].id;
      await fn(tx, { propertyId: p.id, unitId });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const floorLevels = (tx: Tx) =>
  rows<{ level: number; units: string }>(
    tx,
    sql`select f.level, coalesce(string_agg(u.name, ', ' order by u.name), '') as units
      from public.floor f left join public.unit u on u.floor_id = f.id and u.parent_unit_id is null
      group by f.id, f.level order by f.level`,
  );

const edit = (over: Record<string, unknown> = {}) => ({
  name: "Cuarto 101",
  monthlyPrice: "500",
  areaM2: null,
  bathroom: null,
  furnished: false,
  spaceType: null,
  ...over,
});

describe("editar el edificio", () => {
  it("agrega, mueve y quita pisos, y los niveles se renumeran", async () => {
    await withBuilding(async (tx, { propertyId }) => {
      await m.addFloor(tx, propertyId);
      expect((await floorLevels(tx)).map((f) => f.level)).toEqual([1, 2, 3]);

      const [piso1] = await rows<{ id: string }>(tx, sql`select id from public.floor where level = 1`);
      await m.moveFloor(tx, piso1.id, "up");
      expect((await floorLevels(tx)).map((f) => f.units)).toEqual(["Departamento 201", "Cuarto 101", ""]);

      await m.deleteFloor(tx, piso1.id);
      expect(await floorLevels(tx)).toEqual([
        { level: 1, units: "Departamento 201" },
        { level: 2, units: "" },
      ]);
    });
  });

  it("agrega unidades con nombre propio y desmarca 'ocupa todo el piso' si ya no es la única", async () => {
    await withBuilding(async (tx, { unitId }) => {
      const apt = await unitId("Departamento 201");
      await m.updateUnit(
        tx,
        apt,
        edit({
          name: "Departamento 201",
          monthlyPrice: "1500",
          rentalMode: "whole",
          occupiesWholeFloor: true,
        }),
      );
      const [f] = await rows<{ floor_id: string }>(
        tx,
        sql`select floor_id from public.unit where id = ${apt}`,
      );
      await m.addUnit(tx, f.floor_id, "room");
      const units = await rows<{ name: string; occupies_whole_floor: boolean }>(
        tx,
        sql`select name, occupies_whole_floor from public.unit where floor_id = ${f.floor_id} and parent_unit_id is null order by name`,
      );
      expect(units).toEqual([
        { name: "Cuarto 202", occupies_whole_floor: false },
        { name: "Departamento 201", occupies_whole_floor: false },
      ]);
    });
  });

  it("al pasar un departamento a 'por cuartos', el precio pasa a los cuartos", async () => {
    await withBuilding(async (tx, { unitId }) => {
      const apt = await unitId("Departamento 201");
      await m.updateUnit(
        tx,
        apt,
        edit({ name: "Departamento 201", monthlyPrice: "1500", rentalMode: "by_room" }),
      );
      const [row] = await rows<{ monthly_price: string | null }>(
        tx,
        sql`select monthly_price from public.unit where id = ${apt}`,
      );
      expect(row.monthly_price).toBeNull();

      await m.addRoom(tx, apt);
      const rooms = await rows<{ name: string }>(
        tx,
        sql`select name from public.unit where parent_unit_id = ${apt} order by name`,
      );
      expect(rooms.map((r) => r.name)).toEqual(["Cuarto 201-B", "Dormitorio 1"]);
    });
  });

  it("rechaza nombres repetidos y precio en un cuarto que no se alquila solo", async () => {
    await withBuilding(async (tx, { unitId }) => {
      const room = await unitId("Dormitorio 1");
      await expect(
        m.updateUnit(tx, room, edit({ name: "Dormitorio 1", monthlyPrice: "300" })),
      ).rejects.toThrow("el precio va en lo que se alquila");
      await expect(
        m.updateUnit(tx, room, edit({ name: "Departamento 201", monthlyPrice: null })),
      ).rejects.toThrow("Ya hay una unidad con ese nombre");
    });
  });

  it("guarda tipo de ambiente, baño y amoblado; quitar un departamento quita sus cuartos", async () => {
    await withBuilding(async (tx, { unitId }) => {
      const room = await unitId("Cuarto 101");
      await m.updateUnit(
        tx,
        room,
        edit({ areaM2: 12, bathroom: "private", furnished: true, spaceType: "bedroom" }),
      );
      const [saved] = await rows<Record<string, unknown>>(
        tx,
        sql`select area_m2, bathroom, furnished, space_type from public.unit where id = ${room}`,
      );
      expect(saved).toEqual({
        area_m2: "12.00",
        bathroom: "private",
        furnished: true,
        space_type: "bedroom",
      });

      await m.deleteUnit(tx, await unitId("Departamento 201"));
      const [{ n }] = await rows<{ n: number }>(
        tx,
        sql`select count(*)::int as n from public.unit where name = 'Dormitorio 1'`,
      );
      expect(n).toBe(0);
    });
  });

  it("otra cuenta no puede tocar el edificio", async () => {
    await withBuilding(async (tx, { unitId, propertyId }) => {
      const room = await unitId("Cuarto 101");
      await actAs(tx, B);
      await expect(m.updateUnit(tx, room, edit({ name: "Hackeado" }))).rejects.toThrow("No encontramos");
      await expect(m.deleteUnit(tx, room)).rejects.toThrow("No encontramos");
      // El intento rechazado va en un punto de guardado (savepoint) para no invalidar la transacción.
      await tx.transaction((s) => m.addFloor(s, propertyId)).catch(() => undefined);
      await actAs(tx, A);
      expect((await floorLevels(tx)).length).toBe(2);
    });
  });
});
