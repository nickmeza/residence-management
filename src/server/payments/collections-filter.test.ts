import { describe, expect, it } from "vitest";

import { filterReceipts, hasPayable, matchesFilter, reviewSummary } from "./collections-filter";

const r = (
  residentName: string,
  status: "paid" | "partial" | "pending" | "overdue",
  inReview = 0,
  unit = "",
) => ({
  residentName,
  status,
  inReview,
  units: unit ? [unit] : [],
});

const list = [
  r("Juanito Pérez", "paid", 0, "Cuarto 102"),
  r("María Quispe", "overdue", 0, "Cuarto 101"),
  r("Carlos Ramos", "partial", 1, "Depto 201"),
  r("Lucía Torres", "pending", 1, "Cuarto 202"),
];
const names = (xs: { residentName: string }[]) => xs.map((x) => x.residentName);

describe("filtros de Cobros", () => {
  it("sin filtros ni búsqueda, todos", () => {
    expect(filterReceipts(list, [], "")).toHaveLength(4);
  });

  it("pendientes incluye los pagos parciales", () => {
    expect(names(filterReceipts(list, ["pending"], ""))).toEqual(["Carlos Ramos", "Lucía Torres"]);
  });

  it("por revisar mira los comprobantes, no el estado del recibo", () => {
    expect(matchesFilter(list[2], "review")).toBe(true);
    expect(names(filterReceipts(list, ["review"], ""))).toEqual(["Carlos Ramos", "Lucía Torres"]);
  });

  it("varios filtros suman; la búsqueda ignora tildes y busca también la unidad", () => {
    expect(names(filterReceipts(list, ["paid", "overdue"], ""))).toEqual(["Juanito Pérez", "María Quispe"]);
    expect(names(filterReceipts(list, [], "lucia"))).toEqual(["Lucía Torres"]);
    expect(names(filterReceipts(list, [], "depto"))).toEqual(["Carlos Ramos"]);
    expect(filterReceipts(list, ["paid"], "lucia")).toEqual([]);
  });

  it("registrar pago solo si alguien debe algo", () => {
    expect(hasPayable(list)).toBe(true);
    expect(hasPayable([r("A", "paid")])).toBe(false);
    expect(hasPayable([])).toBe(false);
  });

  it("el aviso separa los comprobantes de otros meses", () => {
    const s = reviewSummary(
      [{ period: "2026-11" }, { period: "2026-10" }, { period: "2026-11" }, { period: "2026-09" }],
      "2026-11",
    );
    expect(s).toEqual({
      total: 4,
      thisMonth: 2,
      others: [
        { period: "2026-09", count: 1 },
        { period: "2026-10", count: 1 },
      ],
    });
  });
});
