import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as m from "@/server/documents/mutations";
import { requirementSchema } from "@/server/documents/schemas";

// Requisitos de documentos contra la base real (RLS activo). Cada prueba deshace todo.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000000c1";
const B = "00000000-0000-4000-8000-0000000000c2";

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];

class Rollback extends Error {}

// A y B tienen cada uno su negocio; A además una propiedad.
async function withBusinesses(
  fn: (tx: Tx, ids: { a: string; b: string; propertyA: string }) => Promise<void>,
) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'c1@prueba.test', '{}', 'authenticated', 'authenticated'),
        (${B}, 'c2@prueba.test', '{}', 'authenticated', 'authenticated')`);
      const create = async (uid: string) => {
        await actAs(tx, uid);
        const [b] = await rows<{ id: string }>(
          tx,
          sql`insert into public.business (owner_id, service, kind, trade_name)
            select id, 'residence', 'natural', 'Residencia' from public.person where user_id = ${uid} returning id`,
        );
        return b.id;
      };
      const b = await create(B);
      const a = await create(A);
      const [p] = await rows<{ id: string }>(
        tx,
        sql`insert into public.property (business_id, name, address, district_city, type)
          values (${a}, 'Edificio A', 'Calle 1', 'Lima', 'building') returning id`,
      );
      await fn(tx, { a, b, propertyA: p.id });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const req = (over: Record<string, unknown> = {}) =>
  requirementSchema.parse({
    name: "DNI",
    description: "",
    propertyId: "",
    required: true,
    acceptedFormats: ["pdf", "image"],
    maxSizeMb: "5",
    ...over,
  });

describe("requisitos de documentos", () => {
  it("A crea, edita y quita los suyos", async () => {
    await withBusinesses(async (tx, { a, propertyA }) => {
      await m.createRequirement(tx, a, req());
      const [r] = await rows<{ id: string }>(tx, sql`select id from public.document_requirement`);
      await m.updateRequirement(
        tx,
        r.id,
        req({ name: "DNI vigente", propertyId: propertyA, required: false }),
      );
      expect(
        await rows(tx, sql`select name, property_id, required from public.document_requirement`),
      ).toEqual([{ name: "DNI vigente", property_id: propertyA, required: false }]);
      await m.deleteRequirement(tx, r.id);
      expect(await rows(tx, sql`select id from public.document_requirement`)).toEqual([]);
    });
  });

  it("nadie crea requisitos en el negocio de otro ni para una propiedad ajena", async () => {
    await withBusinesses(async (tx, { b, propertyA }) => {
      await actAs(tx, B);
      await expect(m.createRequirement(tx, b, req({ propertyId: propertyA }))).rejects.toThrow(/propiedad/);
      await actAs(tx, A);
      await expect(m.createRequirement(tx, b, req())).rejects.toThrow(/No encontramos/);
    });
  });
});
