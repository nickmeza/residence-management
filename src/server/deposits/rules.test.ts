import { describe, expect, it } from "vitest";

import {
  canReportEntry,
  depositAmount,
  depositChargesPaid,
  depositInstallments,
  depositPhase,
  discountProblems,
  entryReportDeadline,
  businessDepositPolicy,
  effectivePolicy,
  settlement,
} from "./rules";

describe("regla 5: monto de la garantía", () => {
  it("sin garantía, 1 mes, 2 meses o monto fijo", () => {
    const rent = "850.50";
    expect(depositAmount({ rule: "none", fixedAmount: null }, rent)).toBe("0.00");
    expect(depositAmount({ rule: "one_month", fixedAmount: null }, rent)).toBe("850.50");
    expect(depositAmount({ rule: "two_months", fixedAmount: null }, rent)).toBe("1701.00");
    expect(depositAmount({ rule: "fixed", fixedAmount: "300" }, rent)).toBe("300.00");
  });

  it("la persona gana sobre la unidad, y la unidad sobre la configuración del negocio", () => {
    const business = { rule: "two_months" as const, fixedAmount: null };
    const unit = { rule: "one_month" as const, fixedAmount: null };
    const nephew = { rule: "none" as const, fixedAmount: null };
    expect(effectivePolicy({ business, unit: null, contract: null })).toBe(business);
    expect(effectivePolicy({ business, unit, contract: null })).toBe(unit);
    expect(effectivePolicy({ business, unit, contract: nephew })).toBe(nephew);
  });

  it("si el negocio no configuró nada: departamento 1 mes, cuarto sin garantía (decisión del dueño, 2026-11-15)", () => {
    expect(businessDepositPolicy(null, "apartment")).toEqual({ rule: "one_month", fixedAmount: null });
    expect(businessDepositPolicy(null, "room")).toEqual({ rule: "none", fixedAmount: null });
    const saved = {
      roomRule: "fixed",
      roomFixedAmount: "200.00",
      apartmentRule: "two_months",
      apartmentFixedAmount: null,
    } as const;
    expect(businessDepositPolicy(saved, "room")).toEqual({ rule: "fixed", fixedAmount: "200.00" });
    expect(businessDepositPolicy(saved, "apartment")).toEqual({ rule: "two_months", fixedAmount: null });
    // Sin nada en ningún nivel (no debería pasar), no se pide garantía.
    expect(effectivePolicy({ business: null, unit: null, contract: null }).rule).toBe("none");
  });
});

describe("reglas 6 y 7: liquidación", () => {
  it("devuelve la garantía menos los descuentos vigentes y ajustados; los retirados no cuentan", () => {
    const s = settlement({
      deposit: "500",
      discounts: [
        { amount: "80", status: "active" },
        { amount: "20.50", status: "adjusted" },
        { amount: "100", status: "withdrawn" },
      ],
    });
    expect(s.totalDiscounts).toBe("100.50");
    expect(s.refund).toBe("399.50");
    expect(s.payableNow).toBe("399.50");
    expect(s.excess).toBe("0.00");
  });

  it("nunca es negativo; lo que pasa la garantía queda como diferencia por cobrar", () => {
    const s = settlement({ deposit: "300", discounts: [{ amount: "450", status: "active" }] });
    expect(s.refund).toBe("0.00");
    expect(s.excess).toBe("150.00");
  });

  it("lo disputado no se resta ni se paga: se devuelve ya lo que nadie discute", () => {
    const s = settlement({
      deposit: "500",
      discounts: [
        { amount: "100", status: "active" },
        { amount: "50", status: "disputed" },
      ],
    });
    expect(s.totalDiscounts).toBe("100.00");
    expect(s.disputed).toBe("50.00");
    expect(s.hasDisputes).toBe(true);
    expect(s.refund).toBe("400.00");
    expect(s.payableNow).toBe("350.00");
    expect(s.fullyRefunded).toBe(false);
  });

  it("descuenta lo ya devuelto y sabe cuándo se terminó de devolver", () => {
    const discounts = [{ amount: "100", status: "active" as const }];
    expect(settlement({ deposit: "500", discounts, refunded: "300" }).payableNow).toBe("100.00");
    const done = settlement({ deposit: "500", discounts, refunded: "400" });
    expect(done.payableNow).toBe("0.00");
    expect(done.fullyRefunded).toBe(true);
  });

  it("un disputado no cuenta para la diferencia por cobrar hasta resolverse", () => {
    const s = settlement({
      deposit: "100",
      discounts: [
        { amount: "80", status: "active" },
        { amount: "90", status: "disputed" },
      ],
    });
    expect(s.excess).toBe("0.00");
    expect(s.payableNow).toBe("0.00");
  });
});

describe("regla 8: lo reportado al ingresar es la base", () => {
  it("sin reporte en ese rubro, se descuenta normal", () => {
    expect(
      discountProblems({ area: "door", worseThanEntry: false, hasPhoto: false, entryAreas: ["walls"] }),
    ).toEqual([]);
  });

  it("con reporte, solo si está peor que al entrar y con foto", () => {
    const base = { area: "walls" as const, entryAreas: ["walls" as const] };
    expect(discountProblems({ ...base, worseThanEntry: false, hasPhoto: true })).toEqual([
      "needs_worse_than_entry",
    ]);
    expect(discountProblems({ ...base, worseThanEntry: true, hasPhoto: false })).toEqual(["needs_photo"]);
    expect(discountProblems({ ...base, worseThanEntry: true, hasPhoto: true })).toEqual([]);
  });

  it("el residente reporta solo en los primeros 7 días hábiles (lunes a viernes) del contrato", () => {
    // 2026-03-01 es domingo: los 7 días hábiles son lun 2 … vie 6, lun 9 y mar 10.
    expect(entryReportDeadline("2026-03-01", 7)).toBe("2026-03-10");
    // Empieza un viernes: lun 9 … vie 13 y lun 16, mar 17 (no cuentan sábado ni domingo).
    expect(entryReportDeadline("2026-03-06", 7)).toBe("2026-03-17");
    expect(entryReportDeadline("2026-03-02", 0)).toBe("2026-03-02");
    expect(canReportEntry({ startDate: "2026-03-01", today: "2026-02-25", windowDays: 7 })).toBe(true);
    expect(canReportEntry({ startDate: "2026-03-01", today: "2026-03-10", windowDays: 7 })).toBe(true);
    expect(canReportEntry({ startDate: "2026-03-01", today: "2026-03-11", windowDays: 7 })).toBe(false);
  });
});

describe("estado de la garantía", () => {
  it("por cobrar hasta que se paga su cargo; en disputa si hay descuentos disputados", () => {
    expect(depositPhase({ status: "held", chargePaid: false, hasDisputes: false })).toBe("unpaid");
    expect(depositPhase({ status: "held", chargePaid: true, hasDisputes: false })).toBe("held");
    expect(depositPhase({ status: "settling", chargePaid: true, hasDisputes: true })).toBe("disputed");
    expect(depositPhase({ status: "none", chargePaid: false, hasDisputes: false })).toBe("none");
  });
});

describe("garantía en otro mes o en cuotas (decisión del dueño, 2026-11-15)", () => {
  it("una sola cuota: entera en el mes elegido", () => {
    expect(depositInstallments({ amount: "800", firstDue: "2026-05-05", count: 1 })).toEqual([
      { period: "2026-05", dueDate: "2026-05-05", amount: "800.00" },
    ]);
  });

  it("en cuotas mensuales; los céntimos que sobran van en la última; meses cortos usan su último día", () => {
    expect(depositInstallments({ amount: "1000", firstDue: "2026-12-31", count: 3 })).toEqual([
      { period: "2026-12", dueDate: "2026-12-31", amount: "333.33" },
      { period: "2027-01", dueDate: "2027-01-31", amount: "333.33" },
      { period: "2027-02", dueDate: "2027-02-28", amount: "333.34" },
    ]);
  });

  it("pagada solo cuando todas sus cuotas están cubiertas", () => {
    const charges = [
      { id: "a", contractId: "k", concept: "deposit" },
      { id: "b", contractId: "k", concept: "deposit" },
      { id: "r", contractId: "k", concept: "rent" },
    ];
    expect(depositChargesPaid({ contractId: "k", charges, covered: new Set(["a"]) })).toBe(false);
    expect(depositChargesPaid({ contractId: "k", charges, covered: new Set(["a", "b"]) })).toBe(true);
    expect(depositChargesPaid({ contractId: "otro", charges, covered: new Set(["a", "b"]) })).toBe(false);
  });
});
