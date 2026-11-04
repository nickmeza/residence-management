import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { insertSetup } from "@/server/onboarding/save";
import { setupSchema } from "@/server/onboarding/schema";

// Guarda la configuración del registro en la base real, como una cuenta con sesión (RLS activo),
// y la deshace al final. Comprueba que las filas y sus relaciones quedan bien.

const USER = "00000000-0000-4000-8000-0000000000c1";
const business = {
  kind: "natural",
  tradeName: "Residencia de prueba",
  legalName: "",
  ruc: "",
  phone: "",
  contactEmail: "",
  city: "Lima",
  address: "",
  paymentMethods: ["yape"],
  billingDay: "31",
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
  services: { residence: true, mealPlan: true },
  residenceBusiness: business,
  mealPlanBusiness: {
    ...business,
    sameAsResidence: true,
    tradeName: "Pensión de prueba",
    address: "Av. Ejemplo 1",
  },
  property: {
    type: "building",
    ownerLivesHere: "no",
    name: "Edificio de prueba",
    address: "Calle Ejemplo 123",
    districtCity: "Lima",
    floors: [
      { units: [unit({ key: "a", name: "Cuarto 101", monthlyPrice: "500" })] },
      {
        units: [
          unit({
            key: "d",
            type: "apartment",
            name: "Departamento 201",
            rentalMode: "by_room",
            rooms: [
              { key: "d1", name: "Cuarto 201-A", monthlyPrice: "600", areaM2: "" },
              { key: "d2", name: "Cuarto 201-B", monthlyPrice: "600", areaM2: "" },
            ],
          }),
        ],
      },
    ],
  },
});

class Rollback extends Error {}

describe("guardar la configuración del registro", () => {
  it("crea negocios, propiedad, pisos y unidades con RLS activo", async () => {
    let checked = false;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role)
          values (${USER}, 'c@prueba.test', '{"full_name":"Arrendador C"}', 'authenticated', 'authenticated')`);
        await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: USER, role: "authenticated" })}, true),
          set_config('role', 'authenticated', true)`);
        const [me] = (await tx.execute(
          sql`select id from public.person where user_id = ${USER}`,
        )) as unknown as {
          id: string;
        }[];

        await insertSetup(tx, me.id, setup);

        const businesses = (await tx.execute(
          sql`select service, trade_name, billing_day from public.business order by service`,
        )) as unknown as { service: string; trade_name: string; billing_day: number }[];
        expect(businesses).toEqual([
          { service: "residence", trade_name: "Residencia de prueba", billing_day: 31 },
          { service: "meal_plan", trade_name: "Pensión de prueba", billing_day: 31 },
        ]);

        const units = (await tx.execute(sql`select f.level, u.name, u.monthly_price, p.name as parent
          from public.unit u join public.floor f on f.id = u.floor_id left join public.unit p on p.id = u.parent_unit_id
          order by f.level, u.name`)) as unknown as {
          level: number;
          name: string;
          monthly_price: string | null;
          parent: string | null;
        }[];
        expect(units).toEqual([
          { level: 1, name: "Cuarto 101", monthly_price: "500.00", parent: null },
          { level: 2, name: "Cuarto 201-A", monthly_price: "600.00", parent: "Departamento 201" },
          { level: 2, name: "Cuarto 201-B", monthly_price: "600.00", parent: "Departamento 201" },
          { level: 2, name: "Departamento 201", monthly_price: null, parent: null },
        ]);
        checked = true;
        throw new Rollback();
      });
    } catch (e) {
      if (!(e instanceof Rollback)) throw e;
    }
    expect(checked).toBe(true);
  });
});
