import { describe, expect, it } from "vitest";

import { formatLongDate } from "@/server/contracts/dates";

import { contractHeadline } from "./home";

const today = "2026-11-12";
const base = { phase: "active" as const, startDate: "2026-08-01", endDate: "2026-12-31" };

describe("contractHeadline", () => {
  it("sin contrato no hay línea", () => {
    expect(contractHeadline(null, today)).toBeNull();
  });

  it("cuenta los días hasta el fin", () => {
    expect(contractHeadline(base, today)).toBe("Tu contrato vence en 49 días");
    expect(contractHeadline({ ...base, phase: "ending_soon", endDate: "2026-11-13" }, today)).toBe(
      "Tu contrato vence mañana",
    );
    expect(contractHeadline({ ...base, phase: "ending_soon", endDate: today }, today)).toBe(
      "Tu contrato vence hoy",
    );
  });

  it("mes a mes, por empezar, por firmar y terminado", () => {
    expect(contractHeadline({ ...base, endDate: null }, today)).toBe("Tu contrato es mes a mes");
    expect(contractHeadline({ ...base, phase: "upcoming", startDate: "2026-12-01" }, today)).toBe(
      `Tu contrato empieza el ${formatLongDate("2026-12-01")}`,
    );
    expect(contractHeadline({ ...base, phase: "pending_signature" }, today)).toBe(
      "Tu contrato está listo para firmar",
    );
    expect(contractHeadline({ ...base, phase: "ended", endDate: "2026-10-31" }, today)).toBe(
      `Tu contrato terminó el ${formatLongDate("2026-10-31")}`,
    );
  });
});
