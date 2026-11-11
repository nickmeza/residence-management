import { describe, expect, it } from "vitest";

import type { ContractInput } from "@/server/contracts/rules";

import { currentContract, documentsSummary, matchesFilter, matchesSearch, type ResidentRow } from "./list";

const contract = (over: Partial<ContractInput>): ContractInput => ({
  id: "c",
  unitId: "u",
  startDate: "2026-03-01",
  endDate: "2026-12-31",
  status: "confirmed",
  ...over,
});

describe("contrato que se muestra en la lista", () => {
  const today = "2026-06-01";

  it("prefiere el que ocupa la unidad hoy", () => {
    const old = contract({ id: "viejo", startDate: "2025-03-01", endDate: "2025-12-31" });
    const now = contract({ id: "ahora" });
    const next = contract({ id: "siguiente", startDate: "2027-01-01", endDate: "2027-12-31" });
    expect(currentContract([old, next, now], today)?.id).toBe("ahora");
  });

  it("sin uno de hoy, muestra el que está por empezar; luego el más reciente", () => {
    const old = contract({ id: "viejo", startDate: "2025-03-01", endDate: "2025-12-31" });
    const next = contract({ id: "siguiente", startDate: "2026-08-01", endDate: "2027-07-31" });
    expect(currentContract([old, next], today)?.id).toBe("siguiente");
    expect(currentContract([old], today)?.id).toBe("viejo");
  });

  it("un cancelado solo si no hay otro; sin contratos, ninguno", () => {
    const cancelled = contract({ id: "cancelado", status: "cancelled" });
    const draft = contract({ id: "borrador", status: "draft", startDate: "2026-01-01" });
    expect(currentContract([cancelled, draft], today)?.id).toBe("borrador");
    expect(currentContract([cancelled], today)?.id).toBe("cancelado");
    expect(currentContract([], today)).toBeNull();
  });
});

describe("resumen de documentos", () => {
  const requirements = [
    { id: "dni", unitType: "room" as const, required: true, active: true },
    { id: "matricula", unitType: "room" as const, required: false, active: true },
    { id: "otra", unitType: "apartment" as const, required: true, active: true },
  ];
  const exemptIds: string[] = [];

  it("cuenta los obligatorios que faltan y los que esperan revisión", () => {
    expect(documentsSummary({ unitType: "room", requirements, exemptIds, documents: [] })).toEqual({
      missing: 1,
      inReview: 0,
    });
    expect(
      documentsSummary({
        unitType: "room",
        requirements,
        exemptIds,
        documents: [{ requirementId: "dni", status: "in_review" }],
      }),
    ).toEqual({ missing: 0, inReview: 1 });
  });

  it("lo que no se le pide a esta persona no falta", () => {
    expect(documentsSummary({ unitType: "room", requirements, exemptIds: ["dni"], documents: [] })).toEqual({
      missing: 0,
      inReview: 0,
    });
  });

  it("un rechazado vuelve a faltar", () => {
    expect(
      documentsSummary({
        unitType: "room",
        requirements,
        exemptIds,
        documents: [{ requirementId: "dni", status: "rejected" }],
      }),
    ).toEqual({ missing: 1, inReview: 0 });
  });
});

describe("filtros y buscador", () => {
  const row: ResidentRow = {
    id: "r",
    fullName: "María Pérez",
    phase: "ending_soon",
    unitName: "Cuarto 202",
    searchText: "María Pérez Cuarto 202",
    documents: { missing: 0, inReview: 0 },
  };

  it("filtra por vencer y por documentos pendientes", () => {
    expect(matchesFilter(row, "all")).toBe(true);
    expect(matchesFilter(row, "ending_soon")).toBe(true);
    expect(matchesFilter(row, "documents")).toBe(false);
    expect(matchesFilter({ ...row, documents: { missing: 1, inReview: 0 } }, "documents")).toBe(true);
  });

  it("busca por nombre o unidad sin importar tildes ni mayúsculas", () => {
    expect(matchesSearch(row, "maria")).toBe(true);
    expect(matchesSearch(row, "202")).toBe(true);
    expect(matchesSearch(row, "  ")).toBe(true);
    expect(matchesSearch(row, "luis")).toBe(false);
  });
});
