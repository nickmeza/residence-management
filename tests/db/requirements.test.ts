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

// A y B tienen cada uno su negocio; A además un residente (sin cuenta).
async function withBusinesses(
  fn: (tx: Tx, ids: { a: string; b: string; residentA: string }) => Promise<void>,
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
      await tx.execute(sql`insert into public.person (id, full_name)
        values ('00000000-0000-4000-8000-0000000000c9', 'Residente de prueba')`);
      const [r] = await rows<{ id: string }>(
        tx,
        sql`insert into public.resident (business_id, person_id)
          values (${a}, '00000000-0000-4000-8000-0000000000c9') returning id`,
      );
      await fn(tx, { a, b, residentA: r.id });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const req = (over: Record<string, unknown> = {}) =>
  requirementSchema.parse({
    unitType: "room",
    name: "DNI",
    description: "",
    required: true,
    acceptedFormats: ["pdf", "image"],
    maxSizeMb: "5",
    ...over,
  });

describe("requisitos de documentos", () => {
  it("A crea, edita y quita los suyos", async () => {
    await withBusinesses(async (tx, { a }) => {
      await m.createRequirement(tx, a, req());
      const [r] = await rows<{ id: string }>(tx, sql`select id from public.document_requirement`);
      await m.updateRequirement(
        tx,
        r.id,
        req({ name: "DNI vigente", unitType: "apartment", required: false }),
      );
      await m.setRequirementActive(tx, r.id, false);
      expect(
        await rows(tx, sql`select name, unit_type, required, active from public.document_requirement`),
      ).toEqual([{ name: "DNI vigente", unit_type: "apartment", required: false, active: false }]);
      await m.deleteRequirement(tx, r.id);
      expect(await rows(tx, sql`select id from public.document_requirement`)).toEqual([]);
    });
  });

  it("nadie crea requisitos en el negocio de otro", async () => {
    await withBusinesses(async (tx, { b }) => {
      await expect(m.createRequirement(tx, b, req())).rejects.toThrow(/No encontramos/);
    });
  });

  it("A deja de pedirle un requisito a su residente y luego se lo vuelve a pedir", async () => {
    await withBusinesses(async (tx, { a, residentA }) => {
      const requirementId = await m.createRequirement(tx, a, req());
      const asked = (value: boolean) =>
        m.setAsked(tx, { residentId: residentA, requirementId, asked: value, userId: A });
      await asked(false);
      await asked(false); // dos veces no duplica
      expect(await rows(tx, sql`select resident_id from public.document_requirement_exemption`)).toEqual([
        { resident_id: residentA },
      ]);
      await asked(true);
      expect(await rows(tx, sql`select id from public.document_requirement_exemption`)).toEqual([]);
    });
  });

  it("B no toca las excepciones del residente de A ni usa sus requisitos", async () => {
    await withBusinesses(async (tx, { a, b, residentA }) => {
      const requirementA = await m.createRequirement(tx, a, req());
      await actAs(tx, B);
      const requirementB = await m.createRequirement(tx, b, req());
      await expect(
        m.setAsked(tx, { residentId: residentA, requirementId: requirementA, asked: false, userId: B }),
      ).rejects.toThrow(/No encontramos/);
      // Directo en la base: la regla RLS lo rechaza.
      await expect(
        tx.execute(sql`insert into public.document_requirement_exemption (resident_id, requirement_id)
          values (${residentA}, ${requirementB})`),
      ).rejects.toThrow();
    });
  });
});
