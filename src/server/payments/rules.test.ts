import { describe, expect, it } from "vitest";

import { fromCents, toCents } from "./money";
import { chargeStatus, daysLate, dueDate, groupByBusiness, proofNeedsReview, rentPeriods } from "./rules";

describe("dinero en céntimos", () => {
  it("convierte sin perder decimales", () => {
    expect(toCents("500")).toBe(50000);
    expect(toCents("0.1") + toCents("0.2")).toBe(toCents("0.3"));
    expect(fromCents(70150)).toBe("701.50");
    expect(() => toCents("abc")).toThrow();
  });
});

describe("día de pago y estado del cargo", () => {
  it("31 es fin de mes; en meses cortos, el último día", () => {
    expect(dueDate("2026-03", 31)).toBe("2026-03-31");
    expect(dueDate("2026-02", 31)).toBe("2026-02-28");
    expect(dueDate("2028-02", 30)).toBe("2028-02-29");
    expect(dueDate("2026-04", 5)).toBe("2026-04-05");
  });

  it("pendiente hasta el día de pago, vencido desde el día siguiente", () => {
    expect(chargeStatus({ dueDate: "2026-04-05", paid: false, today: "2026-04-05" })).toBe("pending");
    expect(chargeStatus({ dueDate: "2026-04-05", paid: false, today: "2026-04-06" })).toBe("overdue");
    expect(chargeStatus({ dueDate: "2026-04-05", paid: true, today: "2026-05-01" })).toBe("paid");
    expect(daysLate("2026-04-05", "2026-04-15")).toBe(10);
    expect(daysLate("2026-04-05", "2026-04-01")).toBe(0);
  });
});

describe("meses a cobrar de un contrato", () => {
  it("de su inicio hasta su fin o hasta el mes indicado", () => {
    expect(rentPeriods({ startDate: "2026-11-15", endDate: "2027-02-10" }, "2027-12")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(rentPeriods({ startDate: "2026-11-01", endDate: null }, "2026-12")).toEqual([
      "2026-11",
      "2026-12",
    ]);
    expect(rentPeriods({ startDate: "2027-01-01", endDate: null }, "2026-12")).toEqual([]);
  });
});

describe("comprobante y recibo único", () => {
  it("un comprobante con otro monto queda en revisión", () => {
    expect(proofNeedsReview("500", "500.00")).toBe(false);
    expect(proofNeedsReview("450", "500.00")).toBe(true);
  });

  it("agrupa los cargos por negocio", () => {
    const groups = groupByBusiness([
      { businessId: "residencia", id: 1 },
      { businessId: "pension", id: 2 },
      { businessId: "residencia", id: 3 },
    ]);
    expect(groups.map((g) => [g.businessId, g.charges.map((c) => c.id)])).toEqual([
      ["residencia", [1, 3]],
      ["pension", [2]],
    ]);
  });
});
