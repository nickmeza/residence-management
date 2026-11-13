import { describe, expect, it } from "vitest";

import { filterDeposits, matchesDepositFilter, needsSettlement } from "./list-filter";

const rows = [
  {
    id: "a",
    phase: "held" as const,
    contractPhase: "active" as const,
    residentName: "María",
    unitName: "101",
  },
  {
    id: "b",
    phase: "held" as const,
    contractPhase: "ending_soon" as const,
    residentName: "Carlos",
    unitName: "201",
  },
  {
    id: "c",
    phase: "disputed" as const,
    contractPhase: "ended" as const,
    residentName: "Lucía",
    unitName: "202",
  },
  {
    id: "d",
    phase: "unpaid" as const,
    contractPhase: "active" as const,
    residentName: "Ana",
    unitName: "302",
  },
  {
    id: "e",
    phase: "returned" as const,
    contractPhase: "ended" as const,
    residentName: "Diego",
    unitName: "301",
  },
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("filtros de Garantías", () => {
  it("por liquidar: retenida y el contrato termina pronto o ya terminó", () => {
    expect(needsSettlement(rows[0])).toBe(false);
    expect(needsSettlement(rows[1])).toBe(true);
    expect(needsSettlement(rows[2])).toBe(true);
    expect(needsSettlement(rows[4])).toBe(false);
  });

  it("en liquidación incluye las disputadas", () => {
    expect(matchesDepositFilter(rows[2], "settling")).toBe(true);
    expect(matchesDepositFilter(rows[0], "settling")).toBe(false);
  });

  it("sin filtros, todas; varios suman; la búsqueda ignora tildes", () => {
    expect(filterDeposits(rows, [], "")).toHaveLength(5);
    expect(ids(filterDeposits(rows, ["unpaid", "returned"], ""))).toEqual(["d", "e"]);
    expect(ids(filterDeposits(rows, [], "lucia"))).toEqual(["c"]);
  });
});
