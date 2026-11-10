import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { hashInvitationToken } from "@/server/residents/invitation";
import * as m from "@/server/residents/mutations";
import { residentSchema, type ResidentInput } from "@/server/residents/schemas";

// Agregar, editar e invitar residentes contra la base real, como una cuenta con sesión (RLS activo).
// Cada prueba deshace todo al final.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000000f1";
const B = "00000000-0000-4000-8000-0000000000f2";
const C = "00000000-0000-4000-8000-0000000000f3";

const form = (over: Partial<ResidentInput> = {}) =>
  residentSchema.parse({
    fullName: "Residente de Prueba",
    phone: "987 654 321",
    email: "",
    identityDocumentType: "dni",
    identityDocumentNumber: "12345678",
    university: "Universidad de ejemplo",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
    ...over,
  });

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];

class Rollback extends Error {}

// A tiene un negocio de Residencia; B es otro arrendador con el suyo.
async function withBusinesses(fn: (tx: Tx, ids: { businessA: string; businessB: string }) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'f1@prueba.test', '{"full_name":"A"}', 'authenticated', 'authenticated'),
        (${B}, 'f2@prueba.test', '{"full_name":"B"}', 'authenticated', 'authenticated')`);
      const created = async (uid: string, name: string) => {
        await actAs(tx, uid);
        const [b] = await rows<{ id: string }>(
          tx,
          sql`insert into public.business (owner_id, service, kind, trade_name)
            select id, 'residence', 'natural', ${name} from public.person where user_id = ${uid} returning id`,
        );
        return b.id;
      };
      const businessB = await created(B, "Residencia B");
      const businessA = await created(A, "Residencia A");
      await fn(tx, { businessA, businessB });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

describe("residentes", () => {
  it("A agrega un residente: persona sin cuenta y ficha en su negocio", async () => {
    await withBusinesses(async (tx, { businessA }) => {
      const id = await m.createResident(tx, businessA, form());
      expect(id).toBeTruthy();
      const [r] = await rows<Record<string, unknown>>(
        tx,
        sql`select p.full_name, p.user_id, p.identity_document_number, r.university
          from public.resident r join public.person p on p.id = r.person_id where r.id = ${id}`,
      );
      expect(r).toEqual({
        full_name: "Residente de Prueba",
        user_id: null,
        identity_document_number: "12345678",
        university: "Universidad de ejemplo",
      });
    });
  });

  it("nadie agrega residentes al negocio de otro", async () => {
    await withBusinesses(async (tx, { businessB }) => {
      expect(await m.createResident(tx, businessB, form())).toBeNull();
    });
  });

  it("A edita los datos; B no puede", async () => {
    await withBusinesses(async (tx, { businessA }) => {
      const id = (await m.createResident(tx, businessA, form()))!;
      expect(
        await m.updateResident(tx, id, form({ fullName: "Nombre corregido", notes: "Paga puntual" })),
      ).toBe(true);
      const [r] = await rows<{ full_name: string; notes: string }>(
        tx,
        sql`select p.full_name, r.notes from public.resident r join public.person p on p.id = r.person_id`,
      );
      expect(r).toEqual({ full_name: "Nombre corregido", notes: "Paga puntual" });

      await actAs(tx, B);
      expect(await m.updateResident(tx, id, form({ fullName: "Intruso" }))).toBe(false);
    });
  });

  it("con cuenta, A cambia la ficha de su negocio pero no los datos personales", async () => {
    await withBusinesses(async (tx, { businessA }) => {
      const id = (await m.createResident(tx, businessA, form()))!;
      // Simula que la persona ya creó su cuenta (lo hará la invitación en la parte 4.6).
      await tx.execute(sql`reset role`);
      await tx.execute(sql`insert into auth.users (id, email, aud, role)
        values (${C}, 'f3@prueba.test', 'authenticated', 'authenticated')`);
      await tx.execute(sql`delete from public.person where user_id = ${C}`);
      await tx.execute(sql`update public.person set user_id = ${C}
        where id = (select person_id from public.resident where id = ${id})`);
      await actAs(tx, A);
      expect(await m.updateResident(tx, id, form({ fullName: "Otro nombre", notes: "Nota nueva" }))).toBe(
        true,
      );
      const [r] = await rows<{ full_name: string; notes: string }>(
        tx,
        sql`select p.full_name, r.notes from public.resident r join public.person p on p.id = r.person_id`,
      );
      expect(r).toEqual({ full_name: "Residente de Prueba", notes: "Nota nueva" });
      expect(
        (await m.createInvitation(tx, { residentId: id, token: "x", expiresAt: new Date(), userId: A }))
          .status,
      ).toBe("has_account");
    });
  });

  it("una invitación nueva reemplaza a la anterior y solo guarda el hash", async () => {
    await withBusinesses(async (tx, { businessA }) => {
      const id = (await m.createResident(tx, businessA, form()))!;
      const expiresAt = new Date(Date.now() + 86_400_000);
      const first = await m.createInvitation(tx, { residentId: id, token: "primero", expiresAt, userId: A });
      expect(first).toMatchObject({
        status: "ok",
        fullName: "Residente de Prueba",
        businessName: "Residencia A",
      });
      await m.createInvitation(tx, { residentId: id, token: "segundo", expiresAt, userId: A });
      const saved = await rows<{ token_hash: string }>(
        tx,
        sql`select token_hash from public.resident_invitation`,
      );
      expect(saved).toEqual([{ token_hash: hashInvitationToken("segundo") }]);

      await actAs(tx, B);
      expect(
        (await m.createInvitation(tx, { residentId: id, token: "b", expiresAt, userId: B })).status,
      ).toBe("not_found");
    });
  });
});
