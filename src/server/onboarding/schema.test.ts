import { describe, expect, it } from "vitest";

import { buildFloors } from "./build";
import { accountSchema, issuesByPath, setupSchema, type SetupInput } from "./schema";

const business = {
  kind: "company",
  tradeName: "Residencias Norte",
  legalName: "",
  ruc: "20123456789",
  phone: "+51 987 654 321",
  contactEmail: "",
  city: "Lima",
  address: "",
  paymentMethods: ["yape", "transfer"],
  billingDay: "5",
};

const room = (key: string, name: string, monthlyPrice = "") => ({ key, name, monthlyPrice, areaM2: "" });
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

// El edificio del prototipo: 3 pisos, 3 departamentos, 7 unidades alquilables.
const prototype: SetupInput = {
  services: { residence: true, mealPlan: true },
  residenceBusiness: business,
  mealPlanBusiness: {
    ...business,
    sameAsResidence: true,
    tradeName: "Comedor Norte",
    address: "Av. Ejemplo 456",
  },
  property: {
    type: "building",
    ownerLivesHere: "no",
    name: "Residencia Universitaria Norte",
    address: "Calle Ejemplo 123",
    districtCity: "Lima",
    floors: [
      {
        units: [
          unit({
            key: "101",
            type: "apartment",
            name: "Departamento 101",
            monthlyPrice: "1800",
            occupiesWholeFloor: true,
            rooms: [
              room("101-1", "Dormitorio 1"),
              room("101-2", "Dormitorio 2"),
              room("101-3", "Dormitorio 3"),
            ],
          }),
        ],
      },
      {
        units: [
          unit({ key: "201", type: "apartment", name: "Departamento 201", monthlyPrice: "1500" }),
          unit({ key: "202", name: "Cuarto 202", monthlyPrice: "650", areaM2: "12" }),
          unit({ key: "203", name: "Cuarto 203", monthlyPrice: "650" }),
        ],
      },
      {
        units: [
          unit({
            key: "301",
            type: "apartment",
            name: "Departamento 301",
            rentalMode: "by_room",
            rooms: ["A", "B", "C"].map((l) => room(`301-${l}`, `Cuarto 301-${l}`, "600")),
          }),
        ],
      },
    ],
  },
};

describe("registro: configuración", () => {
  it("acepta el edificio del prototipo y copia los datos de la Residencia a la Pensión", () => {
    const result = setupSchema.parse(prototype);
    expect(result.residence?.ruc).toBe("20123456789");
    expect(result.residence?.billingDay).toBe(5);
    expect(result.mealPlan).toMatchObject({
      tradeName: "Comedor Norte",
      ruc: "20123456789",
      address: "Av. Ejemplo 456",
    });
    expect(result.property?.floors).toHaveLength(3);
  });

  it("sin Residencia no se pide propiedad ni negocio de residencia", () => {
    const result = setupSchema.parse({
      services: { residence: false, mealPlan: true },
      mealPlanBusiness: { ...business, sameAsResidence: false },
    });
    expect(result).toMatchObject({ residence: null, property: null });
    expect(result.mealPlan?.tradeName).toBe("Residencias Norte");
  });

  it("pide al menos un servicio", () => {
    const result = setupSchema.safeParse({ services: { residence: false, mealPlan: false } });
    expect(result.success).toBe(false);
  });

  it("muestra cada error junto a su campo", () => {
    const bad = structuredClone(prototype) as {
      residenceBusiness: { ruc: string; paymentMethods: string[] };
    } & SetupInput;
    bad.residenceBusiness.ruc = "123";
    bad.residenceBusiness.paymentMethods = [];
    const result = setupSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesByPath(result.error)).toMatchObject({
        "residenceBusiness.ruc": "El RUC tiene 11 dígitos.",
        "residenceBusiness.paymentMethods": "Elige al menos un método de pago.",
      });
    }
  });

  it("aplica las reglas del edificio", () => {
    const withIssues = (mutate: (floors: ReturnType<typeof structuredClone<typeof prototype>>) => void) => {
      const copy = structuredClone(prototype);
      mutate(copy);
      const result = setupSchema.safeParse(copy);
      return result.success ? {} : issuesByPath(result.error);
    };
    type P = { property: { floors: { units: Record<string, unknown>[] }[] } };

    // "Ocupa todo el piso" con otra unidad al lado.
    expect(
      withIssues((c) => {
        (c as unknown as P).property.floors[0].units.push(unit({ key: "102", name: "Cuarto 102" }));
      }),
    ).toHaveProperty(["property.floors.0.units.0.occupiesWholeFloor"]);
    // Por cuartos con precio en el departamento.
    expect(
      withIssues((c) => {
        (c as unknown as P).property.floors[2].units[0].monthlyPrice = "1800";
      }),
    ).toHaveProperty(["property.floors.2.units.0.monthlyPrice"]);
    // Nombres repetidos en el piso.
    expect(
      withIssues((c) => {
        (c as unknown as P).property.floors[1].units[2].name = "cuarto 202";
      }),
    ).toHaveProperty(["property.floors.1.units.2.name"]);
  });
});

describe("registro: cuenta", () => {
  const account = {
    fullName: "Ana Pérez",
    email: "Ana@Ejemplo.PE",
    password: "Residencia1",
    acceptTerms: true,
  };

  it("acepta una contraseña con mayúscula y número", () => {
    expect(accountSchema.parse(account).email).toBe("ana@ejemplo.pe");
  });

  it("pide mayúscula, número y aceptar los términos", () => {
    const errors = (over: object) => {
      const r = accountSchema.safeParse({ ...account, ...over });
      return r.success ? {} : issuesByPath(r.error);
    };
    expect(errors({ password: "residencia1" })).toEqual({ password: "Agrega una letra mayúscula." });
    expect(errors({ password: "Residencia" })).toEqual({ password: "Agrega un número." });
    expect(errors({ acceptTerms: false })).toHaveProperty("acceptTerms");
  });
});

describe("registro: armar los pisos", () => {
  it("ubica todo sin solapes y pone el precio solo donde se alquila", () => {
    const floors = buildFloors(setupSchema.parse(prototype).property!);
    expect(floors.map((f) => f.level)).toEqual([1, 2, 3]);
    const all = floors.flatMap((f) => f.units);
    expect(all).toHaveLength(11);
    expect(all.find((u) => u.key === "101-1")).toMatchObject({ parentKey: "101", monthlyPrice: null });
    expect(all.find((u) => u.key === "301")).toMatchObject({ rentalMode: "by_room", monthlyPrice: null });
    expect(all.find((u) => u.key === "301-A")?.monthlyPrice).toBe("600");
    expect(all.find((u) => u.key === "202")?.areaM2).toBe("12");
  });
});
