import { describe, expect, it } from "vitest";

import { canDiscount, depositAmount, settlement } from "./rules";

describe("regla 5: monto de la garantía", () => {
  it("sin garantía, 1 mes, 2 meses o monto fijo", () => {
    const rent = "850.50";
    expect(depositAmount({ policy: { kind: "none" }, unitException: null, monthlyRent: rent })).toBe("0.00");
    expect(depositAmount({ policy: { kind: "one_month" }, unitException: null, monthlyRent: rent })).toBe(
      "850.50",
    );
    expect(depositAmount({ policy: { kind: "two_months" }, unitException: null, monthlyRent: rent })).toBe(
      "1701.00",
    );
    expect(
      depositAmount({ policy: { kind: "fixed", amount: "300" }, unitException: null, monthlyRent: rent }),
    ).toBe("300.00");
  });

  it("la excepción de la unidad gana sobre la política", () => {
    expect(
      depositAmount({ policy: { kind: "two_months" }, unitException: { kind: "none" }, monthlyRent: "500" }),
    ).toBe("0.00");
  });
});

describe("reglas 6 y 7: liquidación", () => {
  it("devuelve la garantía menos los descuentos vigentes y ajustados; los retirados no cuentan", () => {
    expect(
      settlement({
        deposit: "500",
        discounts: [
          { amount: "80", status: "active" },
          { amount: "20.50", status: "adjusted" },
          { amount: "100", status: "withdrawn" },
        ],
      }),
    ).toEqual({ totalDiscounts: "100.50", refund: "399.50", discountsExceedDeposit: false, canPay: true });
  });

  it("nunca es negativo", () => {
    const s = settlement({ deposit: "300", discounts: [{ amount: "450", status: "active" }] });
    expect(s.refund).toBe("0.00");
    expect(s.discountsExceedDeposit).toBe(true);
  });

  it("con un descuento disputado no se paga", () => {
    expect(settlement({ deposit: "500", discounts: [{ amount: "50", status: "disputed" }] }).canPay).toBe(
      false,
    );
  });
});

describe("regla 8: la revisión de ingreso es la base", () => {
  const entry = [
    { area: "walls" as const, condition: "minor_detail" as const },
    { area: "door" as const, condition: "good" as const },
  ];

  it("lo que ya estaba mal al ingresar no se descuenta", () => {
    expect(canDiscount("walls", entry)).toBe(false);
    expect(canDiscount("door", entry)).toBe(true);
    expect(canDiscount("keys", entry)).toBe(true);
  });
});
