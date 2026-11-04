import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// Prueba del RLS de person, property, floor y unit con dos cuentas de prueba (A y B).
// Todo corre dentro de una transacción que se deshace al final: la base queda como estaba.

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL en .env.local para correr pnpm test:db.");

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
afterAll(() => sql.end());

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const SQUARE = sql.json([
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 8 },
  { x: 0, z: 8 },
]);

class Rollback extends Error {}
type Tx = postgres.TransactionSql;

// Corre `fn` en una transacción que siempre se deshace.
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

// Igual que src/db/rls.ts: la base pasa a tratar las consultas como del usuario `uid`.
async function actAs(tx: Tx, uid: string) {
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`;
}

async function actAsAdmin(tx: Tx) {
  await tx`reset role`;
}

// true si la consulta falla (la deshace con un savepoint para seguir usando la transacción).
async function fails(tx: Tx, query: (s: Tx) => Promise<unknown>) {
  try {
    await tx.savepoint((s) => query(s as unknown as Tx));
    return false;
  } catch {
    return true;
  }
}

async function setUp(tx: Tx) {
  await tx`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (${A}, 'a@prueba.test', '{"full_name":"Arrendadora A"}', 'authenticated', 'authenticated'),
    (${B}, 'b@prueba.test', '{}', 'authenticated', 'authenticated')`;
  await actAs(tx, A);
  const [business] = await tx`insert into public.business (owner_id, service, kind, trade_name)
    select id, 'residence', 'natural', 'Residencia A' from public.person returning id`;
  const [property] = await tx`insert into public.property (business_id, name, address, district_city, type)
    values (${business.id}, 'Residencia A', 'Calle Ejemplo 123', 'Lima', 'building') returning id`;
  const [floor] = await tx`insert into public.floor (property_id, level, outline)
    values (${property.id}, 1, ${SQUARE}) returning id`;
  const [unit] =
    await tx`insert into public.unit (floor_id, type, name, monthly_price, pos_x, pos_z, width, depth)
    values (${floor.id}, 'room', 'Cuarto 101', 500, 0, 0, 3, 3) returning id`;
  await actAsAdmin(tx);
  return {
    businessId: business.id as string,
    propertyId: property.id as string,
    floorId: floor.id as string,
    unitId: unit.id as string,
  };
}

// Cuántas filas de cada tabla ve quien está consultando.
const countAll = (tx: Tx) =>
  tx`select (select count(*) from public.person)::int pe, (select count(*) from public.business)::int b,
    (select count(*) from public.property)::int p, (select count(*) from public.floor)::int f,
    (select count(*) from public.unit)::int u`;

// B crea su propio negocio de Residencia y devuelve su id.
async function createBusinessForB(tx: Tx) {
  await actAs(tx, B);
  const [own] = await tx`insert into public.business (owner_id, service, kind, trade_name)
    select id, 'residence', 'natural', 'Residencia B' from public.person returning id`;
  return own.id as string;
}

describe("registro", () => {
  it("al crear una cuenta se crea su persona, con el nombre o la parte del correo", async () => {
    await inRollback(async (tx) => {
      await setUp(tx);
      const people = await tx`select full_name, email from public.person
        where user_id in (${A}, ${B}) order by email`;
      expect(people).toEqual([
        { full_name: "Arrendadora A", email: "a@prueba.test" },
        { full_name: "b", email: "b@prueba.test" },
      ]);
    });
  });

  it("un usuario no puede llamar la función del trigger", async () => {
    const [row] =
      await sql`select has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as can`;
    expect(row.can).toBe(false);
  });
});

describe("RLS entre dos arrendadores", () => {
  it("cada uno ve solo su persona y sus datos", async () => {
    await inRollback(async (tx) => {
      await setUp(tx);
      await actAs(tx, A);
      expect((await countAll(tx))[0]).toEqual({ pe: 1, b: 1, p: 1, f: 1, u: 1 });

      await actAs(tx, B);
      expect((await countAll(tx))[0]).toEqual({ pe: 1, b: 0, p: 0, f: 0, u: 0 });
    });
  });

  it("B no puede cambiar ni borrar lo de A", async () => {
    await inRollback(async (tx) => {
      const ids = await setUp(tx);
      await actAs(tx, B);
      expect(
        await tx`update public.unit set monthly_price = 1 where id = ${ids.unitId} returning id`,
      ).toHaveLength(0);
      expect(
        await tx`update public.property set name = 'x' where id = ${ids.propertyId} returning id`,
      ).toHaveLength(0);
      expect(await tx`delete from public.floor where id = ${ids.floorId} returning id`).toHaveLength(0);
      expect(
        await tx`update public.business set ruc = '20123456789' where id = ${ids.businessId} returning id`,
      ).toHaveLength(0);
      expect(
        await tx`update public.person set full_name = 'x' where user_id = ${A} returning id`,
      ).toHaveLength(0);
    });
  });

  it("B no puede agregar pisos, cuartos ni propiedades a lo de A, ni crear negocios a nombre de A", async () => {
    await inRollback(async (tx) => {
      const ids = await setUp(tx);
      await actAs(tx, B);
      expect(
        await fails(
          tx,
          (s) =>
            s`insert into public.floor (property_id, level, outline) values (${ids.propertyId}, 2, ${SQUARE})`,
        ),
      ).toBe(true);
      expect(
        await fails(
          tx,
          (s) => s`insert into public.unit (floor_id, type, name, pos_x, pos_z, width, depth)
            values (${ids.floorId}, 'room', 'Intruso', 5, 5, 2, 2)`,
        ),
      ).toBe(true);
      expect(
        await fails(
          tx,
          (s) => s`insert into public.property (business_id, name, address, district_city, type)
            values (${ids.businessId}, 'x', 'x', 'x', 'room')`,
        ),
      ).toBe(true);
      expect(
        await fails(
          tx,
          (s) => s`insert into public.business (owner_id, service, kind, trade_name)
            values ((select id from public.person where user_id = ${A}), 'meal_plan', 'natural', 'x')`,
        ),
      ).toBe(true);
    });
  });

  it("B no puede pasarse a sí mismo la propiedad de A ni mover sus pisos a otra propiedad", async () => {
    await inRollback(async (tx) => {
      const ids = await setUp(tx);
      const businessB = await createBusinessForB(tx);
      const [own] = await tx`insert into public.property (business_id, name, address, district_city, type)
        values (${businessB}, 'Residencia B', 'Calle 2', 'Lima', 'room') returning id`;
      // B tampoco puede mover la propiedad de A a su propio negocio.
      expect(
        await tx`update public.property set business_id = ${businessB} where id = ${ids.propertyId} returning id`,
      ).toHaveLength(0);
      expect(
        await tx`update public.floor set property_id = ${own.id} where id = ${ids.floorId} returning id`,
      ).toHaveLength(0);
      // A tampoco puede regalar su piso a la propiedad de B: el "with check" lo impide.
      await actAs(tx, A);
      expect(
        await fails(tx, (s) => s`update public.floor set property_id = ${own.id} where id = ${ids.floorId}`),
      ).toBe(true);
    });
  });

  it("sin sesión no se ve nada", async () => {
    await inRollback(async (tx) => {
      await setUp(tx);
      await tx`set local role anon`;
      expect((await countAll(tx))[0]).toEqual({ pe: 0, b: 0, p: 0, f: 0, u: 0 });
    });
  });

  it("un mismo arrendador puede tener varios negocios", async () => {
    await inRollback(async (tx) => {
      await setUp(tx);
      await actAs(tx, A);
      await tx`insert into public.business (owner_id, service, kind, trade_name)
        select id, 'meal_plan', 'company', 'Pensión A' from public.person`;
      expect((await countAll(tx))[0].b).toBe(2);
    });
  });
});

describe("reglas de negocios en la base", () => {
  it("el RUC debe tener 11 dígitos y el día de cobro ir del 1 al 31", async () => {
    await inRollback(async (tx) => {
      const { businessId } = await setUp(tx);
      for (const ruc of ["123", "2012345678X", "201234567890"]) {
        expect(
          await fails(tx, (s) => s`update public.business set ruc = ${ruc} where id = ${businessId}`),
        ).toBe(true);
      }
      expect(
        await fails(tx, (s) => s`update public.business set ruc = '20123456789' where id = ${businessId}`),
      ).toBe(false);
      for (const day of [0, 32]) {
        expect(
          await fails(tx, (s) => s`update public.business set billing_day = ${day} where id = ${businessId}`),
        ).toBe(true);
      }
    });
  });

  it("no se puede borrar un negocio que tiene propiedades", async () => {
    await inRollback(async (tx) => {
      const { businessId } = await setUp(tx);
      expect(await fails(tx, (s) => s`delete from public.business where id = ${businessId}`)).toBe(true);
    });
  });
});

describe("reglas de unidades en la base", () => {
  const insertUnit = (s: Tx, floorId: string, extra: postgres.PendingQuery<postgres.Row[]>) =>
    s`insert into public.unit (floor_id, pos_x, pos_z, width, depth, type, name, rental_mode, monthly_price, occupies_whole_floor)
      values (${floorId}, 0, 0, 5, 5, ${extra})`;

  it("rechaza combinaciones inválidas", async () => {
    await inRollback(async (tx) => {
      const { floorId } = await setUp(tx);
      const invalid = [
        tx`'apartment', 'Depto por cuartos con precio', 'by_room', 900, false`,
        tx`'apartment', 'Depto sin modo', null, null, false`,
        tx`'room', 'Cuarto con modo', 'whole', 500, false`,
        tx`'room', 'Cuarto que ocupa el piso', null, 500, true`,
        tx`'room', 'Cuarto con precio negativo', null, -1, false`,
      ];
      for (const values of invalid) {
        expect(await fails(tx, (s) => insertUnit(s, floorId, values))).toBe(true);
      }
    });
  });

  it("acepta un departamento completo y uno por cuartos sin precio", async () => {
    await inRollback(async (tx) => {
      const { floorId } = await setUp(tx);
      expect(
        await fails(tx, (s) =>
          insertUnit(s, floorId, tx`'apartment', 'Depto completo', 'whole', 1500, true`),
        ),
      ).toBe(false);
      expect(
        await fails(tx, (s) =>
          insertUnit(s, floorId, tx`'apartment', 'Depto por cuartos', 'by_room', null, false`),
        ),
      ).toBe(false);
    });
  });
});
