import { describe, expect, it } from "vitest";

import { unitStatus } from "./status";

describe("estado de la unidad", () => {
  it("sin contrato ni mantenimiento está disponible", () => {
    expect(unitStatus()).toBe("available");
  });

  it("con contrato vigente está ocupada, y el mantenimiento abierto pesa más", () => {
    expect(unitStatus({ hasActiveContract: true })).toBe("occupied");
    expect(unitStatus({ hasActiveContract: true, hasOpenMaintenance: true })).toBe("maintenance");
  });
});
