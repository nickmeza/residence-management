import { describe, expect, it } from "vitest";

import { filterContracts, matchesContractFilter } from "./list-filter";

const rows = [
  { id: "a", phase: "active" as const, searchText: "María Quispe Cuarto 101" },
  { id: "b", phase: "ending_soon" as const, searchText: "Carlos Ramos Depto 201" },
  { id: "c", phase: "draft" as const, searchText: "Lucía Torres Cuarto 202" },
  { id: "d", phase: "cancelled" as const, searchText: "Ana Flores Cuarto 302" },
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("filtros de Contratos", () => {
  it("vigentes incluye los por vencer; terminados incluye los cancelados", () => {
    expect(matchesContractFilter(rows[1], "active")).toBe(true);
    expect(matchesContractFilter(rows[3], "ended")).toBe(true);
    expect(matchesContractFilter(rows[2], "pending")).toBe(true);
  });

  it("sin filtros, todos; varios suman; la búsqueda ignora tildes", () => {
    expect(filterContracts(rows, [], "")).toHaveLength(4);
    expect(ids(filterContracts(rows, ["pending", "ended"], ""))).toEqual(["c", "d"]);
    expect(ids(filterContracts(rows, [], "lucia"))).toEqual(["c"]);
    expect(filterContracts(rows, ["ended"], "lucia")).toEqual([]);
  });
});
