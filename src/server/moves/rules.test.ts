import { describe, expect, it } from "vitest";

import { cleanChecklist, pendingMovesSoon, upcomingMoves, type MoveContract } from "./rules";

const c = (
  id: string,
  startDate: string,
  endDate: string | null,
  status: MoveContract["status"] = "confirmed",
) => ({
  id,
  residentId: `r-${id}`,
  residentName: id,
  unitName: "201",
  startDate,
  endDate,
  status,
});
const today = "2026-11-15";

describe("ingresos y salidas", () => {
  it("muestra los ingresos y salidas de los próximos 30 días y lo atrasado sin hacer", () => {
    const moves = upcomingMoves(
      [
        c("entra", "2026-11-20", null),
        c("sale", "2026-01-01", "2026-12-01"),
        c("lejos", "2027-02-01", null),
        c("atrasado", "2026-11-12", null),
        c("borrador", "2026-11-18", null, "draft"),
      ],
      [],
      today,
    );
    expect(moves.map((m) => `${m.residentName}:${m.kind}`)).toEqual([
      "atrasado:check_in",
      "entra:check_in",
      "sale:check_out",
    ]);
  });

  it("lo ya hecho de días pasados desaparece; lo hecho de hoy sigue, marcado", () => {
    const events = [
      { contractId: "a", kind: "check_in" as const, scheduledAt: null, doneAt: new Date() },
      { contractId: "b", kind: "check_in" as const, scheduledAt: null, doneAt: new Date() },
    ];
    const moves = upcomingMoves([c("a", "2026-11-13", null), c("b", today, null)], events, today);
    expect(moves.map((m) => [m.id, m.done])).toEqual([["b", true]]);
  });

  it("el Panel cuenta lo que falta en los próximos 7 días", () => {
    const moves = upcomingMoves([c("x", "2026-11-18", null), c("y", "2026-12-10", null)], [], today);
    expect(pendingMovesSoon(moves, today)).toBe(1);
  });

  it("el checklist solo guarda sus propias casillas", () => {
    expect(cleanChecklist("check_out", { keys: true, inventory: true, hack: true })).toEqual({
      keys: true,
      inspection: false,
      belongings: false,
      meters: false,
      refund_account: false,
    });
  });
});
