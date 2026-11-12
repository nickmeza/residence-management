import { describe, expect, it } from "vitest";

import { fromCents, toCents } from "./money";
import {
  chargeChanges,
  daysLate,
  dueDate,
  groupByBusiness,
  nextPeriod,
  proofMismatch,
  receiptSummary,
  rentCharges,
} from "./rules";

describe("dinero en céntimos", () => {
  it("convierte sin perder decimales", () => {
    expect(toCents("500")).toBe(50000);
    expect(toCents("0.1") + toCents("0.2")).toBe(toCents("0.3"));
    expect(fromCents(70150)).toBe("701.50");
    expect(() => toCents("abc")).toThrow();
  });
});

describe("día de pago", () => {
  it("31 es fin de mes; en meses cortos, el último día", () => {
    expect(dueDate("2026-03", 31)).toBe("2026-03-31");
    expect(dueDate("2026-02", 31)).toBe("2026-02-28");
    expect(dueDate("2028-02", 30)).toBe("2028-02-29");
    expect(dueDate("2026-04", 5)).toBe("2026-04-05");
  });

  it("cuenta los días de atraso", () => {
    expect(daysLate("2026-04-05", "2026-04-15")).toBe(10);
    expect(daysLate("2026-04-05", "2026-04-01")).toBe(0);
    expect(nextPeriod("2026-12")).toBe("2027-01");
    expect(nextPeriod("2026-01", 11)).toBe("2026-12");
  });
});

describe("recibos de renta de un contrato", () => {
  const base = { monthlyRent: "600", paymentDay: 5, today: "2026-03-10" };

  it("uno por mes; el mes incompleto se cobra por los días (proporcional)", () => {
    const charges = rentCharges({ ...base, startDate: "2026-03-15", endDate: "2026-05-10", prorate: true });
    expect(charges.map((c) => c.period)).toEqual(["2026-03", "2026-04", "2026-05"]);
    // Marzo: del 15 al 31 = 17 de 31 días. Mayo: del 1 al 10 = 10 de 31.
    expect(charges[0]).toMatchObject({ amount: "329.03", days: 17 });
    expect(charges[1]).toMatchObject({ amount: "600.00", days: null, dueDate: "2026-04-05" });
    expect(charges[2]).toMatchObject({ amount: "193.55", days: 10 });
  });

  it("o completo, si el arrendador lo prefiere", () => {
    const charges = rentCharges({ ...base, startDate: "2026-03-15", endDate: "2026-05-10", prorate: false });
    expect(charges.map((c) => c.amount)).toEqual(["600.00", "600.00", "600.00"]);
  });

  it("el día de pago no cae antes de entrar ni después de salir", () => {
    const [first] = rentCharges({ ...base, startDate: "2026-03-15", endDate: null, prorate: true });
    expect(first.dueDate).toBe("2026-03-15");
    const charges = rentCharges({
      ...base,
      paymentDay: 20,
      startDate: "2026-03-01",
      endDate: "2026-04-10",
      prorate: true,
    });
    expect(charges.at(-1)?.dueDate).toBe("2026-04-10");
  });

  it("sin fecha de fin: 12 meses desde hoy", () => {
    const charges = rentCharges({ ...base, startDate: "2026-01-01", endDate: null, prorate: true });
    expect(charges[0].period).toBe("2026-01");
    expect(charges.at(-1)?.period).toBe("2027-02");
  });

  it("al cambiar el contrato se crean, corrigen y quitan solo los que hace falta", () => {
    const existing = [
      { id: "a", period: "2026-03", amount: "600.00", dueDate: "2026-03-05" },
      { id: "b", period: "2026-04", amount: "600.00", dueDate: "2026-04-05" },
      { id: "c", period: "2026-05", amount: "600.00", dueDate: "2026-05-05" },
    ];
    // Termina antes: el 10 de abril.
    const expected = rentCharges({
      ...base,
      startDate: "2026-03-01",
      endDate: "2026-04-10",
      prorate: true,
    });
    const changes = chargeChanges(existing, expected);
    expect(changes.insert).toEqual([]);
    expect(changes.update).toEqual([{ id: "b", amount: "200.00", dueDate: "2026-04-05" }]);
    expect(changes.remove).toEqual(["c"]);
  });
});

describe("estado del recibo", () => {
  const charges = [
    { amount: "600", dueDate: "2026-04-05" },
    { amount: "600", dueDate: "2026-04-01" },
  ];

  it("pendiente hasta el día de pago, vencido desde el día siguiente", () => {
    expect(receiptSummary({ charges, confirmedPayments: [], today: "2026-04-01" }).status).toBe("pending");
    const late = receiptSummary({ charges, confirmedPayments: [], today: "2026-04-03" });
    expect(late).toMatchObject({ status: "overdue", nextDue: "2026-04-01", daysLate: 2, balance: "1200.00" });
  });

  it("acepta pagos parciales: se aplican en orden de vencimiento", () => {
    const partial = receiptSummary({ charges, confirmedPayments: [{ amount: "700" }], today: "2026-04-03" });
    expect(partial).toMatchObject({ status: "partial", paid: "700.00", balance: "500.00", nextDue: "2026-04-05" });
    const after = receiptSummary({ charges, confirmedPayments: [{ amount: "700" }], today: "2026-04-06" });
    expect(after.status).toBe("overdue");
  });

  it("pagado; lo pagado de más es saldo a favor", () => {
    const paid = receiptSummary({
      charges,
      confirmedPayments: [{ amount: "1000" }, { amount: "250" }],
      today: "2026-05-01",
    });
    expect(paid).toMatchObject({ status: "paid", balance: "0.00", credit: "50.00", daysLate: 0 });
  });

  it("un comprobante con otro monto se marca para revisarlo", () => {
    expect(proofMismatch("500", "600.00")).toBe(true);
    expect(proofMismatch("600", "600.00")).toBe(false);
  });
});

describe("recibo único", () => {
  it("agrupa los cargos por negocio, aunque sean de dueños distintos", () => {
    const groups = groupByBusiness([
      { businessId: "residencia", amount: "650" },
      { businessId: "pension", amount: "450" },
      { businessId: "residencia", amount: "50" },
    ]);
    expect(groups.map((g) => [g.businessId, g.charges.length])).toEqual([
      ["residencia", 2],
      ["pension", 1],
    ]);
  });
});
