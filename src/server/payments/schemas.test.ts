import { describe, expect, it } from "vitest";

import { issuesByPath } from "@/server/onboarding/schema";

import { depositSettingsSchema, discountSchema, paymentSchema } from "./schemas";

const UUID = "00000000-0000-4000-8000-000000000001";

describe("formularios de cobros y garantía", () => {
  it("un pago necesita monto mayor que cero, método y fecha", () => {
    const base = {
      residentId: UUID,
      period: "2026-03",
      amount: "650",
      method: "yape",
      paidOn: "2026-03-05",
      operationCode: "",
      proofPath: "",
    };
    expect(paymentSchema.parse(base)).toMatchObject({ amount: "650", operationCode: null, proofPath: null });
    const bad = paymentSchema.safeParse({ ...base, amount: "0", period: "2026-13" });
    expect(bad.success ? {} : issuesByPath(bad.error)).toMatchObject({
      amount: expect.any(String),
      period: expect.any(String),
    });
  });

  it("configuración de garantía: monto fijo pide el monto, y se limpia si no es fijo", () => {
    const base = {
      roomRule: "fixed",
      roomFixedAmount: "",
      apartmentRule: "two_months",
      apartmentFixedAmount: "900",
      covers: ["walls"],
      refundDays: "7",
      refundMethods: ["yape"],
      entryReportDays: "7",
      prorateRent: true,
    };
    const bad = depositSettingsSchema.safeParse(base);
    expect(bad.success ? {} : issuesByPath(bad.error)).toHaveProperty("roomFixedAmount");
    const ok = depositSettingsSchema.parse({ ...base, roomFixedAmount: "300" });
    expect(ok).toMatchObject({ roomFixedAmount: "300", apartmentFixedAmount: null, refundDays: 7 });
  });

  it("un descuento lleva nota para el residente y monto", () => {
    const bad = discountSchema.safeParse({
      area: "walls",
      note: "",
      amount: "",
      photoPath: "",
      worseThanEntry: false,
    });
    expect(bad.success ? {} : issuesByPath(bad.error)).toMatchObject({
      note: expect.any(String),
      amount: expect.any(String),
    });
  });
});
