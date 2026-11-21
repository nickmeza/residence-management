import { describe, expect, it } from "vitest";

import { compareUnits, requestProblem } from "./rules";

describe("requestProblem", () => {
  it("un pedido abierto se agenda, se hace o se cancela", () => {
    expect(requestProblem("requested", "scheduled")).toBeNull();
    expect(requestProblem("scheduled", "done")).toBeNull();
    expect(requestProblem("requested", "cancelled")).toBeNull();
  });

  it("no vuelve a 'pedido' y lo cerrado no cambia", () => {
    expect(requestProblem("scheduled", "requested")).not.toBeNull();
    expect(requestProblem("done", "scheduled")).not.toBeNull();
    expect(requestProblem("cancelled", "done")).not.toBeNull();
  });
});

describe("compareUnits", () => {
  it("pone primero lo que hay que limpiar", () => {
    const units = [
      { status: "clean" as const, label: "101" },
      { status: "dirty" as const, label: "202" },
      { status: "inspected" as const, label: "103" },
    ];
    expect(units.sort(compareUnits).map((u) => u.label)).toEqual(["202", "101", "103"]);
  });
});
