import { describe, expect, it } from "vitest";

import { eventsByDay, monthRange, monthWeeks, parseMonth, shiftMonth } from "./rules";

describe("meses", () => {
  it("lee el mes de la dirección o usa el de hoy", () => {
    expect(parseMonth("2026-12", "2026-11-17")).toBe("2026-12");
    expect(parseMonth("2026-13", "2026-11-17")).toBe("2026-11");
    expect(parseMonth(undefined, "2026-11-17")).toBe("2026-11");
  });

  it("avanza y retrocede cruzando el año", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("sabe el primer y el último día", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("monthWeeks", () => {
  it("arma semanas de lunes a domingo que cubren el mes", () => {
    // Noviembre de 2026 empieza en domingo y termina en lunes.
    const weeks = monthWeeks("2026-11");
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.at(-1)?.[0]).toBe("2026-11-30");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks).toHaveLength(6);
  });
});

describe("eventsByDay", () => {
  it("agrupa por día con ingresos y salidas primero", () => {
    const map = eventsByDay([
      { key: "a", date: "2026-11-20", kind: "cleaning", label: "Pasillo", href: "/" },
      { key: "b", date: "2026-11-20", kind: "check_in", label: "Ana", href: "/" },
      { key: "c", date: "2026-11-21", kind: "receipt", label: "Luis", href: "/" },
    ]);
    expect(map.get("2026-11-20")?.map((e) => e.key)).toEqual(["b", "a"]);
    expect(map.get("2026-11-21")).toHaveLength(1);
  });
});
