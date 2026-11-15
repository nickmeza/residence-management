import { describe, expect, it } from "vitest";

import { blocksUnitNow, compareRequests, statusProblem } from "./rules";

const at = (d: string) => new Date(`${d}T12:00:00Z`);

describe("mantenimiento", () => {
  it("un pedido cerrado no vuelve a abrirse", () => {
    expect(statusProblem("open", "in_progress")).toBeNull();
    expect(statusProblem("in_progress", "done")).toBeNull();
    expect(statusProblem("done", "open")).not.toBeNull();
    expect(statusProblem("cancelled", "in_progress")).not.toBeNull();
    expect(statusProblem("done", "done")).toBeNull();
  });

  it("la unidad queda en mantenimiento solo mientras el pedido que la bloquea está activo", () => {
    expect(blocksUnitNow({ status: "open", blocksUnit: true })).toBe(true);
    expect(blocksUnitNow({ status: "in_progress", blocksUnit: true })).toBe(true);
    expect(blocksUnitNow({ status: "done", blocksUnit: true })).toBe(false);
    expect(blocksUnitNow({ status: "open", blocksUnit: false })).toBe(false);
  });

  it("ordena lo activo por prioridad y antigüedad, y lo cerrado al final", () => {
    const list = [
      { id: "cerrado", status: "done", priority: "urgent", createdAt: at("2026-11-14") },
      { id: "normal-viejo", status: "open", priority: "normal", createdAt: at("2026-11-01") },
      { id: "urgente", status: "in_progress", priority: "urgent", createdAt: at("2026-11-10") },
      { id: "normal-nuevo", status: "open", priority: "normal", createdAt: at("2026-11-12") },
    ] as const;
    expect([...list].sort(compareRequests).map((r) => r.id)).toEqual([
      "urgente",
      "normal-viejo",
      "normal-nuevo",
      "cerrado",
    ]);
  });
});
