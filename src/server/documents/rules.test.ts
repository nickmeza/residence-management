import { describe, expect, it } from "vitest";

import { askedRequirements, type RequirementRule } from "./rules";

const req = (id: string, over: Partial<RequirementRule> = {}): RequirementRule => ({
  id,
  unitType: "room",
  required: true,
  active: true,
  ...over,
});

const ids = (rs: RequirementRule[]) => rs.map((r) => r.id);

describe("documentos que se le piden a un residente", () => {
  const requirements = [
    req("dni-cuarto"),
    req("constancia"),
    req("recibo", { required: false }),
    req("aval-cuarto", { active: false }),
    req("dni-depa", { unitType: "apartment" }),
    req("ingresos", { unitType: "apartment" }),
  ];

  it("usa la lista de lo que alquila: cuarto o departamento", () => {
    expect(ids(askedRequirements(requirements, "room", []))).toEqual(["dni-cuarto", "constancia"]);
    expect(ids(askedRequirements(requirements, "apartment", []))).toEqual(["dni-depa", "ingresos"]);
  });

  it("no pide opcionales ni inactivos", () => {
    const asked = ids(askedRequirements(requirements, "room", []));
    expect(asked).not.toContain("recibo");
    expect(asked).not.toContain("aval-cuarto");
  });

  it("no pide lo que el arrendador quitó para esa persona", () => {
    expect(ids(askedRequirements(requirements, "room", ["constancia"]))).toEqual(["dni-cuarto"]);
  });

  it("sin unidad todavía no pide nada", () => {
    expect(askedRequirements(requirements, null, [])).toEqual([]);
  });
});
