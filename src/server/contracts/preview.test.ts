import { describe, expect, it } from "vitest";

import { contractPreview, type ContractPreviewInput } from "./preview";

const base: ContractPreviewInput = {
  startDate: "2026-12-01",
  endDate: "",
  monthlyRent: "650",
  paymentDay: "5",
  prorate: true,
  unitDeposit: { rule: "one_month", fixedAmount: null },
  depositRule: "",
  depositFixedAmount: "",
  depositDueDate: "",
  today: "2026-11-20",
};

describe("resumen de un contrato nuevo", () => {
  it("el primer recibo trae la renta y la garantía si se cobra ese mes", () => {
    const p = contractPreview(base);
    expect(p.deposit).toEqual({ rule: "one_month", amount: "650.00", dueDate: "2026-12-01" });
    expect(p.firstReceipt).toEqual({
      period: "2026-12",
      dueDate: "2026-12-05",
      rent: "650.00",
      days: null,
      deposit: "650.00",
      total: "1300.00",
    });
  });

  it("si empieza a mitad de mes y se prorratea, cobra solo los días", () => {
    const p = contractPreview({
      ...base,
      startDate: "2026-12-17",
      unitDeposit: { rule: "none", fixedAmount: null },
    });
    expect(p.firstReceipt).toMatchObject({ rent: "314.52", days: 15, deposit: null, total: "314.52" });
  });

  it("lo que se decide para la persona gana; una garantía para otro mes no suma al primer recibo", () => {
    const p = contractPreview({
      ...base,
      depositRule: "fixed",
      depositFixedAmount: "300",
      depositDueDate: "2027-01-10",
    });
    expect(p.deposit).toEqual({ rule: "fixed", amount: "300.00", dueDate: "2027-01-10" });
    expect(p.firstReceipt).toMatchObject({ deposit: null, total: "650.00" });
  });

  it("sin unidad, renta o fechas válidas no inventa montos", () => {
    expect(contractPreview({ ...base, unitDeposit: null }).deposit).toBeNull();
    expect(contractPreview({ ...base, monthlyRent: "" })).toEqual({ deposit: null, firstReceipt: null });
    expect(contractPreview({ ...base, endDate: "2026-11-01" }).firstReceipt).toBeNull();
    expect(contractPreview({ ...base, depositRule: "fixed", depositFixedAmount: "" }).deposit).toBeNull();
  });
});
