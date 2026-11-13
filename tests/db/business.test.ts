import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { BuildingError, setCoverPhoto } from "@/server/building/mutations";
import { BusinessError, deleteBusiness } from "@/server/business/mutations";
import { insertSetup } from "@/server/onboarding/save";
import { setupSchema } from "@/server/onboarding/schema";

// Eliminar un negocio (Configuración › Negocio) contra la base real, con RLS activo. Cada prueba deshace todo.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000000e1";
const B = "00000000-0000-4000-8000-0000000000e2";

const setup = setupSchema.parse({
  services: { residence: true, mealPlan: false },
  residenceBusiness: {
    kind: "natural",
    tradeName: "Residencia E",
    legalName: "",
    ruc: "",
    phone: "",
    contactEmail: "",
    city: "",
    address: "",
    paymentMethods: ["yape"],
    billingDay: "5",
  },
  property: {
    type: "building",
    ownerLivesHere: "yes",
    name: "Edificio E",
    address: "Calle Ejemplo 1",
    districtCity: "Lima",
    floors: [
      {
        units: [
          {
            key: "a",
            type: "room",
            name: "Cuarto 101",
            monthlyPrice: "500",
            areaM2: "",
            occupiesWholeFloor: false,
            rentalMode: "whole",
            rooms: [],
          },
        ],
      },
    ],
  },
});

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];

// Cuenta como A (con RLS): así no entran los datos reales que haya en la base.
const count = async (tx: Tx, table: string) =>
  (await rows<{ n: number }>(tx, sql`select count(*)::int as n from ${sql.raw(`public.${table}`)}`))[0].n;

class Rollback extends Error {}

// El negocio de A con su edificio, dentro de una transacción que siempre se deshace.
async function withBusiness(fn: (tx: Tx, businessId: string) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'e1@prueba.test', '{"full_name":"A"}', 'authenticated', 'authenticated'),
        (${B}, 'e2@prueba.test', '{"full_name":"B"}', 'authenticated', 'authenticated')`);
      await actAs(tx, A);
      const [me] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${A}`);
      await insertSetup(tx, me.id, setup);
      const [b] = await rows<{ id: string }>(tx, sql`select id from public.business`);
      await tx.execute(sql`insert into public.contract_template (business_id, name, body)
        values (${b.id}, 'Plantilla', 'Texto')`);
      await fn(tx, b.id);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

describe("eliminar un negocio", () => {
  it("sin residentes, se borra con su edificio, pisos, unidades y plantillas", async () => {
    await withBusiness(async (tx, businessId) => {
      await deleteBusiness(tx, businessId);
      for (const table of ["business", "property", "floor", "unit", "contract_template"]) {
        expect(await count(tx, table)).toBe(0);
      }
    });
  });

  it("con residentes, no se borra nada", async () => {
    await withBusiness(async (tx, businessId) => {
      // Los datos del residente se crean como administrador; después se vuelve a A.
      await tx.execute(sql`reset role`);
      const [p] = await rows<{ id: string }>(
        tx,
        sql`insert into public.person (full_name) values ('Residente E') returning id`,
      );
      await tx.execute(
        sql`insert into public.resident (business_id, person_id) values (${businessId}, ${p.id})`,
      );
      await actAs(tx, A);
      await expect(deleteBusiness(tx, businessId)).rejects.toThrow(BusinessError);
      expect(await count(tx, "business")).toBe(1);
      expect(await count(tx, "unit")).toBe(1);
    });
  });

  it("otro arrendador no puede borrarlo", async () => {
    await withBusiness(async (tx, businessId) => {
      await actAs(tx, B);
      await expect(deleteBusiness(tx, businessId)).rejects.toThrow("No encontramos ese negocio.");
      await actAs(tx, A);
      expect(await count(tx, "business")).toBe(1);
    });
  });
});

describe("foto de portada del edificio", () => {
  const photo = (businessId: string) => `${businessId}/portadas/00000000-0000-4000-8000-0000000000f1.jpg`;
  const propertyOf = async (tx: Tx) =>
    (
      await rows<{ id: string; cover: string | null }>(
        tx,
        sql`select id, cover_photo_path as cover from public.property`,
      )
    )[0];

  it("el arrendador la pone y la quita; solo acepta su carpeta de portadas", async () => {
    await withBusiness(async (tx, businessId) => {
      const { id } = await propertyOf(tx);
      await setCoverPhoto(tx, id, photo(businessId));
      expect((await propertyOf(tx)).cover).toBe(photo(businessId));
      await expect(setCoverPhoto(tx, id, photo("00000000-0000-4000-8000-0000000000ff"))).rejects.toThrow(
        BuildingError,
      );
      const { oldPath } = await setCoverPhoto(tx, id, null);
      expect(oldPath).toBe(photo(businessId));
      expect((await propertyOf(tx)).cover).toBeNull();
    });
  });

  it("otro arrendador no puede cambiarla", async () => {
    await withBusiness(async (tx, businessId) => {
      const { id } = await propertyOf(tx);
      await actAs(tx, B);
      await expect(setCoverPhoto(tx, id, photo(businessId))).rejects.toThrow("No encontramos el edificio.");
    });
  });

  it("solo un residente del negocio puede ver sus portadas en Storage", async () => {
    await withBusiness(async (tx, businessId) => {
      const canSee = async () =>
        (await rows<{ ok: boolean }>(tx, sql`select public.storage_is_resident_of(${businessId}) as ok`))[0]
          .ok;
      await actAs(tx, B);
      expect(await canSee()).toBe(false);
      await tx.execute(sql`reset role`);
      await tx.execute(sql`insert into public.resident (business_id, person_id)
        select ${businessId}, id from public.person where user_id = ${B}`);
      await actAs(tx, B);
      expect(await canSee()).toBe(true);
      // La función del residente ya trae la columna de la foto (vacía: todavía no tiene contrato).
      const places = await rows<{ property_cover_path: string | null }>(
        tx,
        sql`select property_cover_path from public.my_resident_places()`,
      );
      expect(places).toEqual([{ property_cover_path: null }]);
    });
  });
});
