import { describe, expect, it } from "vitest";

import {
  financeByMonth,
  lastPeriods,
  occupancyByFloor,
  occupancyByMonth,
  pensionByMonth,
  rentableUnits,
  toCsv,
  type ReportUnit,
} from "./rules";

const units: ReportUnit[] = [
  { id: "c1", type: "room", parentId: null, rentalMode: null, floorLabel: "Piso 1" },
  { id: "c2", type: "room", parentId: null, rentalMode: null, floorLabel: "Piso 1" },
  { id: "d1", type: "apartment", parentId: null, rentalMode: "by_room", floorLabel: "Piso 2" },
  { id: "d1a", type: "room", parentId: "d1", rentalMode: null, floorLabel: "Piso 2" },
  { id: "d2", type: "apartment", parentId: null, rentalMode: "whole", floorLabel: "Piso 2" },
  { id: "d2a", type: "room", parentId: "d2", rentalMode: null, floorLabel: "Piso 2" },
];
const living = (unitId: string, startDate: string, endDate: string | null = null) => ({
  unitId,
  startDate,
  endDate,
  status: "confirmed" as const,
});

describe("reportes", () => {
  it("los últimos meses, del más antiguo al más nuevo", () => {
    expect(lastPeriods("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("cuenta solo lo que se alquila por sí mismo", () => {
    expect(rentableUnits(units).map((u) => u.id)).toEqual(["c1", "c2", "d1a", "d2"]);
  });

  it("ocupación de hoy por piso", () => {
    expect(
      occupancyByFloor(units, [living("c1", "2026-01-01"), living("d2", "2026-01-01")], "2026-11-15"),
    ).toEqual([
      { label: "Piso 1", rentable: 2, occupied: 1, percent: 50 },
      { label: "Piso 2", rentable: 2, occupied: 1, percent: 50 },
    ]);
  });

  it("ocupación del mes: días ocupados entre días posibles; el mes en curso hasta hoy", () => {
    const rows = occupancyByMonth(
      units,
      [living("c1", "2026-10-01"), living("c2", "2026-10-16", "2026-10-31")],
      ["2026-10", "2026-11"],
      "2026-11-10",
    );
    // Octubre: 31 + 16 días de 4 × 31 = 47 / 124 ≈ 38 %. Noviembre: 10 de 40 = 25 %.
    expect(rows).toEqual([
      { period: "2026-10", percent: 38 },
      { period: "2026-11", percent: 25 },
    ]);
  });

  it("finanzas del mes: facturado, cobrado (solo confirmado), por cobrar, mantenimiento y neto", () => {
    const [row] = financeByMonth(
      ["2026-11"],
      [
        { period: "2026-11", amount: "650" },
        { period: "2026-11", amount: "700.50" },
      ],
      [
        { period: "2026-11", amount: "650", status: "confirmed" },
        { period: "2026-11", amount: "700.50", status: "in_review" },
      ],
      [{ period: "2026-11", amount: "120" }],
    );
    expect(row).toEqual({
      period: "2026-11",
      billed: "1350.50",
      collected: "650.00",
      pending: "700.50",
      maintenance: "120.00",
      net: "530.00",
    });
  });

  it("pensión: lo cobrado por el día de pago y los comensales del mes", () => {
    expect(
      pensionByMonth(
        ["2026-11"],
        [
          { paidOn: "2026-11-03", amount: "85", status: "confirmed" },
          { paidOn: "2026-11-04", amount: "85", status: "in_review" },
        ],
        [
          { residentId: "a", startDate: "2026-10-01", endDate: null },
          { residentId: "b", startDate: "2026-12-01", endDate: null },
        ],
      ),
    ).toEqual([{ period: "2026-11", collected: "85.00", diners: 1 }]);
  });

  it("CSV con comillas cuando hace falta", () => {
    expect(toCsv(["Nombre", "Monto"], [["Pérez, Ana", 650]])).toBe('Nombre,Monto\r\n"Pérez, Ana",650');
  });
});
