import { describe, expect, it } from "vitest";

import { issuesByPath } from "@/server/onboarding/schema";

import { contractSchema, type ContractFormInput } from "./schemas";

const UUID = "00000000-0000-4000-8000-000000000001";
const valid: ContractFormInput = {
  residentId: UUID,
  unitId: UUID,
  startDate: "2026-03-01",
  endDate: "2026-12-31",
  monthlyRent: "650",
  paymentDay: "5",
  paperwork: "none",
  templateId: "",
  depositRule: "",
  depositFixedAmount: "",
  depositDueDate: "",
};

const errors = (over: Partial<ContractFormInput>) => {
  const parsed = contractSchema.safeParse({ ...valid, ...over });
  return parsed.success ? {} : issuesByPath(parsed.error);
};

describe("formulario de contrato", () => {
  it("acepta un contrato sin papel y deja la plantilla vacía", () => {
    const data = contractSchema.parse(valid);
    expect(data).toMatchObject({ paymentDay: 5, endDate: "2026-12-31", templateId: null });
  });

  it("la fecha de fin es opcional, pero no puede ser antes del inicio", () => {
    expect(contractSchema.parse({ ...valid, endDate: "" }).endDate).toBeNull();
    expect(errors({ endDate: "2026-02-01" })).toHaveProperty("endDate");
  });

  it("revisa la renta y el día de pago", () => {
    expect(errors({ monthlyRent: "650.50" })).toEqual({});
    expect(errors({ monthlyRent: "-1" })).toHaveProperty("monthlyRent");
    expect(errors({ monthlyRent: "seiscientos" })).toHaveProperty("monthlyRent");
    expect(errors({ paymentDay: "32" })).toHaveProperty("paymentDay");
  });

  it("desde plantilla exige elegirla; en otra modalidad se ignora", () => {
    expect(errors({ paperwork: "template" })).toHaveProperty("templateId");
    expect(contractSchema.parse({ ...valid, paperwork: "template", templateId: UUID }).templateId).toBe(UUID);
    expect(contractSchema.parse({ ...valid, paperwork: "paper", templateId: UUID }).templateId).toBeNull();
  });
});
