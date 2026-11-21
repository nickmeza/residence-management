import { describe, expect, it } from "vitest";

import { applicationMoves, isRepeated, normalizePhone, suggestUnit, type SuggestionCandidate } from "./rules";

describe("postulantes", () => {
  it("el mismo celular con o sin +51 y espacios es el mismo", () => {
    expect(normalizePhone("+51 987 654 321")).toBe("987654321");
    expect(normalizePhone("987-654-321")).toBe("987654321");
  });

  it("no deja postular dos veces en 24 horas con el mismo celular", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const before = [{ phone: "987654321", createdAt: new Date("2026-11-15T02:00:00Z") }];
    expect(isRepeated(before, "+51 987 654 321", now)).toBe(true);
    expect(isRepeated(before, "912345678", now)).toBe(false);
    expect(isRepeated(before, "987654321", new Date("2026-11-16T03:00:00Z"))).toBe(false);
  });

  it("una aprobada no vuelve atrás; una rechazada puede pasar a la lista de espera", () => {
    expect(applicationMoves("approved")).toEqual([]);
    expect(applicationMoves("rejected")).toEqual(["waitlist"]);
    expect(applicationMoves("new")).toEqual(["waitlist", "approved", "rejected"]);
  });

  const units: SuggestionCandidate[] = [
    { id: "a", type: "room", label: "101", monthlyPrice: "500.00" },
    { id: "b", type: "room", label: "102", monthlyPrice: "700.00" },
    { id: "c", type: "room", label: "103", monthlyPrice: "600.00" },
    { id: "d", type: "apartment", label: "Dpto 2", monthlyPrice: "1500.00" },
  ];

  it("sugiere el de precio más cercano al presupuesto, del tipo que busca", () => {
    expect(suggestUnit(units, { unitType: "room", budget: "680" })?.id).toBe("b");
    expect(suggestUnit(units, { unitType: "room", budget: "680" })?.differenceCents).toBe(2000);
    expect(suggestUnit(units, { unitType: "apartment", budget: "600" })?.id).toBe("d");
    expect(suggestUnit(units, { unitType: null, budget: "1400" })?.id).toBe("d");
  });

  it("si dos quedan igual de cerca, el más barato; sin presupuesto, el más barato", () => {
    expect(suggestUnit(units, { unitType: "room", budget: "550" })?.id).toBe("a");
    expect(suggestUnit(units, { unitType: "room", budget: null })).toMatchObject({
      id: "a",
      differenceCents: null,
    });
  });

  it("sin unidades libres de ese tipo no sugiere nada", () => {
    expect(suggestUnit(units.slice(0, 3), { unitType: "apartment", budget: "900" })).toBeNull();
    expect(suggestUnit([], { unitType: null, budget: null })).toBeNull();
  });
});
