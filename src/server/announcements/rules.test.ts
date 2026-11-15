import { describe, expect, it } from "vitest";

import { pensionRecipients, residenceRecipients, type RecipientContract } from "./rules";

const units = [
  { id: "u1", floorId: "f1", propertyId: "p1" },
  { id: "u2", floorId: "f2", propertyId: "p1" },
  { id: "u3", floorId: "f3", propertyId: "p2" },
];
const living = (residentId: string, unitId: string): RecipientContract => ({
  residentId,
  unitId,
  startDate: "2026-01-01",
  endDate: null,
  status: "confirmed",
});
const contracts = [
  living("ana", "u1"),
  living("beto", "u2"),
  living("caro", "u3"),
  { ...living("dani", "u1"), endDate: "2026-06-30" },
  { ...living("eva", "u2"), status: "draft" as const },
];
const today = "2026-11-15";

describe("a quién le llega un comunicado", () => {
  it("a todos: solo a quienes viven hoy", () => {
    expect(residenceRecipients({ kind: "all" }, contracts, units, today).sort()).toEqual([
      "ana",
      "beto",
      "caro",
    ]);
  });

  it("a un edificio o a un piso", () => {
    expect(
      residenceRecipients({ kind: "property", propertyId: "p1" }, contracts, units, today).sort(),
    ).toEqual(["ana", "beto"]);
    expect(residenceRecipients({ kind: "floor", floorId: "f2" }, contracts, units, today)).toEqual(["beto"]);
  });

  it("a una persona aunque no tenga contrato vigente", () => {
    expect(residenceRecipients({ kind: "resident", residentId: "dani" }, contracts, units, today)).toEqual([
      "dani",
    ]);
  });

  it("en una pensión, a los comensales con afiliación vigente, sin repetir", () => {
    expect(
      pensionRecipients(
        [
          { residentId: "a", endDate: null },
          { residentId: "a", endDate: "2026-12-31" },
          { residentId: "b", endDate: "2026-10-01" },
        ],
        today,
      ),
    ).toEqual(["a"]);
  });
});
