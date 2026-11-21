import { describe, expect, it } from "vitest";

import { everyLabel, nextDueAfter, occurrencesBetween, step, taskState } from "./rules";

describe("step", () => {
  it("suma días, semanas y meses", () => {
    expect(step("2026-11-16", 1, "day")).toBe("2026-11-17");
    expect(step("2026-11-16", 2, "week")).toBe("2026-11-30");
    expect(step("2026-11-16", 6, "month")).toBe("2027-05-16");
  });

  it("no se pasa del último día del mes", () => {
    expect(step("2026-01-31", 1, "month")).toBe("2026-02-28");
    expect(step("2028-01-31", 1, "month")).toBe("2028-02-29");
  });
});

describe("nextDueAfter", () => {
  it("hecha a tiempo: la siguiente fecha según la frecuencia", () => {
    expect(nextDueAfter("2026-11-16", 1, "week", "2026-11-16")).toBe("2026-11-23");
  });

  it("hecha antes o un poco tarde: mantiene el ritmo", () => {
    expect(nextDueAfter("2026-11-16", 1, "week", "2026-11-14")).toBe("2026-11-23");
    expect(nextDueAfter("2026-11-16", 1, "week", "2026-11-18")).toBe("2026-11-23");
  });

  it("hecha con mucho atraso: salta las fechas que ya pasaron", () => {
    expect(nextDueAfter("2026-11-02", 1, "week", "2026-11-17")).toBe("2026-11-23");
  });
});

describe("taskState", () => {
  it("atrasada, hoy, esta semana o más adelante", () => {
    expect(taskState("2026-11-16", "2026-11-17")).toBe("overdue");
    expect(taskState("2026-11-17", "2026-11-17")).toBe("today");
    expect(taskState("2026-11-24", "2026-11-17")).toBe("soon");
    expect(taskState("2026-11-25", "2026-11-17")).toBe("later");
  });
});

describe("occurrencesBetween", () => {
  it("lista las fechas del mes desde la próxima", () => {
    expect(
      occurrencesBetween({ nextDue: "2026-11-09", every: 1, period: "week" }, "2026-11-01", "2026-11-30"),
    ).toEqual(["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  });

  it("no inventa fechas antes de la próxima", () => {
    expect(
      occurrencesBetween({ nextDue: "2026-12-05", every: 1, period: "month" }, "2026-11-01", "2026-11-30"),
    ).toEqual([]);
  });
});

describe("everyLabel", () => {
  it("dice la frecuencia en palabras", () => {
    expect(everyLabel(1, "week")).toBe("Cada semana");
    expect(everyLabel(6, "month")).toBe("Cada 6 meses");
  });
});
