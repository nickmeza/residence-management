import { describe, expect, it } from "vitest";

import {
  fitFloorsToType,
  initialSetupForm,
  newUnit,
  stepsFor,
  suggestRoomName,
  suggestUnitName,
  toDraft,
  validateStep,
} from "./form";

describe("pasos del registro", () => {
  it("sin Residencia se saltan 'Qué ofreces' y 'Tu propiedad'", () => {
    expect(stepsFor({ services: { residence: true, mealPlan: false } }, true)).toEqual([
      "services",
      "business",
      "offer",
      "building",
      "account",
    ]);
    expect(stepsFor({ services: { residence: false, mealPlan: true } }, true)).toEqual([
      "services",
      "business",
      "account",
    ]);
    expect(stepsFor({ services: { residence: true, mealPlan: false } }, false)).not.toContain("account");
  });

  it("cada paso valida solo lo suyo", () => {
    const form = initialSetupForm();
    expect(validateStep("services", form)).toEqual({});
    expect(validateStep("business", form)).toMatchObject({
      "residenceBusiness.tradeName": "Escribe el nombre de tu negocio.",
      "residenceBusiness.paymentMethods": "Elige al menos un método de pago.",
    });
    expect(validateStep("offer", form)).toHaveProperty(["property.type"]);
  });

  it("con 'usar los mismos datos' la Pensión solo pide su nombre", () => {
    const form = initialSetupForm();
    form.services.mealPlan = true;
    const errors = validateStep("business", form);
    expect(errors).toHaveProperty(["mealPlanBusiness.tradeName"]);
    expect(errors).not.toHaveProperty(["mealPlanBusiness.paymentMethods"]);
  });
});

describe("nombres sugeridos", () => {
  it("siguen el patrón del prototipo", () => {
    expect(suggestUnitName("room", 2, 1)).toBe("Cuarto 202");
    expect(suggestUnitName("apartment", 3, 0)).toBe("Departamento 301");
    expect(suggestRoomName("Departamento 301", 2)).toBe("Cuarto 301-C");
    expect(suggestRoomName("Mi depa", 0)).toBe("Dormitorio 1");
  });
});

describe("ajustar la estructura a lo que ofreces", () => {
  it("un cuarto deja un solo piso con un solo cuarto", () => {
    const floors = [{ units: [newUnit("apartment", 1, 0), newUnit("room", 1, 1)] }, { units: [] }];
    const fitted = fitFloorsToType("room", floors);
    expect(fitted).toHaveLength(1);
    expect(fitted[0].units).toHaveLength(1);
    expect(fitted[0].units[0].type).toBe("room");
  });

  it("un piso deja un solo nivel y un edificio no cambia nada", () => {
    const floors = [{ units: [newUnit("room", 1, 0)] }, { units: [newUnit("room", 2, 0)] }];
    expect(fitFloorsToType("floor", floors)).toHaveLength(1);
    expect(fitFloorsToType("building", floors)).toBe(floors);
  });
});

describe("borrador", () => {
  it("nunca guarda la contraseña", () => {
    const form = initialSetupForm();
    form.account.password = "Secreta123";
    expect(toDraft(form).account.password).toBe("");
  });
});

describe("resumen mientras se arma", () => {
  it("cuenta como el prototipo: 3 pisos, 3 departamentos, 7 alquilables", async () => {
    const { formSummary, newRoom } = await import("./form");
    const apt = (mode: "whole" | "by_room", rooms: number) => ({
      ...newUnit("apartment", 1, 0),
      rentalMode: mode,
      rooms: Array.from({ length: rooms }, (_, i) => newRoom("Departamento 101", i)),
    });
    expect(
      formSummary([
        { units: [apt("whole", 3)] },
        { units: [apt("whole", 0), newUnit("room", 2, 1), newUnit("room", 2, 2)] },
        { units: [apt("by_room", 3)] },
      ]),
    ).toEqual({ floors: 3, apartments: 3, rentable: 7 });
  });
});

describe("indicador de pasos", () => {
  it("muestra 4 pasos y Estructura con sus partes, como el prototipo", async () => {
    const { stepPosition } = await import("./form");
    const steps = stepsFor({ services: { residence: true, mealPlan: true } }, true);
    const pos = stepPosition(steps, "building");
    expect(pos.groups.map((g) => g.label)).toEqual(["Servicios", "Tu negocio", "Estructura", "Cuenta"]);
    expect(pos).toMatchObject({ index: 2, total: 4, part: { index: 1, total: 2 } });
    expect(stepPosition(steps, "business").part).toBeNull();
  });
});
