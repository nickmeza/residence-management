import { describe, expect, it } from "vitest";

import { rectToOutline } from "./geometry";
import { buildingSummary, floorProblems, type UnitInput } from "./rules";

const slab = rectToOutline({ x: 0, z: 0, width: 12, depth: 8 });

function unit(partial: Partial<UnitInput> & Pick<UnitInput, "id">): UnitInput {
  return {
    parentId: null,
    type: "room",
    name: partial.id,
    rentalMode: null,
    occupiesWholeFloor: false,
    monthlyPrice: null,
    x: 0,
    z: 0,
    width: 3,
    depth: 3,
    ...partial,
  };
}

const codes = (units: UnitInput[]) => floorProblems(slab, units).map((p) => p.code);

describe("reglas del piso", () => {
  it("un piso bien armado no tiene problemas", () => {
    expect(
      codes([
        unit({ id: "201", type: "apartment", rentalMode: "whole", monthlyPrice: "1500", width: 6, depth: 5 }),
        unit({ id: "202", x: 6, monthlyPrice: "650" }),
        unit({ id: "203", x: 9, monthlyPrice: "650" }),
      ]),
    ).toEqual([]);
  });

  it("detecta cuartos fuera de la losa, fuera de la cuadrícula y encimados", () => {
    expect(codes([unit({ id: "a", x: 10 })])).toContain("outside_slab");
    expect(codes([unit({ id: "a", x: 0.05 })])).toContain("off_grid");
    expect(codes([unit({ id: "a" }), unit({ id: "b", x: 2 })])).toContain("overlap");
  });

  it("los cuartos de un departamento van dentro de él y no se enciman entre sí", () => {
    const apt = unit({ id: "301", type: "apartment", rentalMode: "by_room", width: 6, depth: 5 });
    expect(
      codes([apt, unit({ id: "301-A", parentId: "301" }), unit({ id: "301-B", parentId: "301", x: 3 })]),
    ).toEqual([]);
    expect(codes([apt, unit({ id: "301-A", parentId: "301", x: 5 })])).toContain("outside_parent");
    // Un cuarto dentro de su departamento no choca con el departamento mismo.
    expect(
      codes([apt, unit({ id: "301-A", parentId: "301" }), unit({ id: "301-B", parentId: "301", x: 1 })]),
    ).toEqual(["overlap"]);
  });

  it("un cuarto solo puede estar dentro de un departamento que exista", () => {
    expect(codes([unit({ id: "a", parentId: "nada" })])).toContain("parent_missing");
    expect(codes([unit({ id: "a" }), unit({ id: "b", parentId: "a", x: 0 })])).toContain(
      "parent_not_apartment",
    );
  });

  it("'ocupa todo el piso' solo con un único departamento en el piso", () => {
    const apt = unit({
      id: "101",
      type: "apartment",
      rentalMode: "whole",
      occupiesWholeFloor: true,
      width: 12,
      depth: 8,
    });
    expect(codes([apt])).toEqual([]);
    expect(codes([{ ...apt, width: 6 }, unit({ id: "102", x: 6 })])).toContain("whole_floor_not_alone");
    // Sus cuartos interiores no cuentan como otra unidad suelta.
    expect(codes([apt, unit({ id: "Dormitorio 1", parentId: "101" })])).toEqual([]);
  });

  it("el precio va solo en lo que se alquila", () => {
    // Por cuartos: precio en cada cuarto, nunca en el departamento.
    const byRoom = unit({ id: "301", type: "apartment", rentalMode: "by_room", width: 6, depth: 5 });
    expect(codes([byRoom, unit({ id: "301-A", parentId: "301", monthlyPrice: "600" })])).toEqual([]);
    // Completo: sus cuartos solo describen.
    const whole = unit({
      id: "201",
      type: "apartment",
      rentalMode: "whole",
      monthlyPrice: "1500",
      width: 6,
      depth: 5,
    });
    expect(codes([whole, unit({ id: "Dormitorio", parentId: "201", monthlyPrice: "500" })])).toContain(
      "price_not_allowed",
    );
  });

  it("no permite dos unidades con el mismo nombre en el piso", () => {
    expect(
      codes([unit({ id: "a", name: "Cuarto 202" }), unit({ id: "b", name: " cuarto 202", x: 3 })]),
    ).toContain("duplicate_name");
  });
});

describe("resumen del edificio", () => {
  it("cuenta pisos, departamentos y unidades alquilables como el prototipo", () => {
    const summary = buildingSummary([
      { units: [unit({ id: "101", type: "apartment", rentalMode: "whole", occupiesWholeFloor: true })] },
      {
        units: [
          unit({ id: "201", type: "apartment", rentalMode: "whole" }),
          unit({ id: "202" }),
          unit({ id: "203" }),
        ],
      },
      {
        units: [
          unit({ id: "301", type: "apartment", rentalMode: "by_room" }),
          unit({ id: "301-A", parentId: "301" }),
          unit({ id: "301-B", parentId: "301" }),
          unit({ id: "301-C", parentId: "301" }),
        ],
      },
    ]);
    expect(summary).toEqual({ floors: 3, apartments: 3, rentable: 7 });
  });
});
