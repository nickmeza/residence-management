import { describe, expect, it } from "vitest";

import {
  attendanceState,
  confirmationOpen,
  coversDay,
  isPaused,
  kitchenCounts,
  limaNow,
  mealDeadline,
  monthEstimate,
  pauseProblem,
  planPriceWarning,
  weekOf,
} from "./rules";

describe("hora límite de confirmación (regla 12)", () => {
  it("cierra a la hora del negocio, o al empezar la comida si es antes", () => {
    expect(mealDeadline("2026-11-13", "12:30:00", "10:00:00")).toBe("2026-11-13T10:00");
    expect(mealDeadline("2026-11-13", "07:00:00", "10:00:00")).toBe("2026-11-13T07:00");
  });

  it("antes de la hora se puede cambiar; desde la hora, ya no", () => {
    const deadline = "2026-11-13T10:00";
    expect(confirmationOpen("2026-11-13T09:59", deadline)).toBe(true);
    expect(confirmationOpen("2026-11-13T10:00", deadline)).toBe(false);
    expect(confirmationOpen("2026-11-12T22:00", deadline)).toBe(true);
  });

  it("la hora es la de Lima (UTC-5)", () => {
    expect(limaNow(new Date("2026-11-13T15:05:00Z"))).toBe("2026-11-13T10:05");
    expect(limaNow(new Date("2026-11-13T03:00:00Z"))).toBe("2026-11-12T22:00");
  });
});

describe("pausas", () => {
  const sub = { startDate: "2026-11-01", endDate: null };
  const base = { today: "2026-11-12", subscription: sub, pauses: [], servedDates: [] };

  it("un día pausado no se cuenta; la afiliación cubre sus fechas", () => {
    expect(isPaused("2026-11-15", [{ fromDate: "2026-11-14", toDate: "2026-11-16" }])).toBe(true);
    expect(isPaused("2026-11-17", [{ fromDate: "2026-11-14", toDate: "2026-11-16" }])).toBe(false);
    expect(coversDay({ startDate: "2026-11-01", endDate: "2026-11-30" }, "2026-12-01")).toBe(false);
  });

  it("no se pausa al revés, en el pasado, fuera de la afiliación ni encima de otra pausa", () => {
    expect(pauseProblem({ ...base, from: "2026-11-20", to: "2026-11-25" })).toBeNull();
    expect(pauseProblem({ ...base, from: "2026-11-25", to: "2026-11-20" })).toMatch(/antes/);
    expect(pauseProblem({ ...base, from: "2026-11-10", to: "2026-11-20" })).toMatch(/ya pasó/);
    expect(
      pauseProblem({
        ...base,
        subscription: { startDate: "2026-11-01", endDate: "2026-11-22" },
        from: "2026-11-20",
        to: "2026-11-25",
      }),
    ).toMatch(/dentro/);
    expect(
      pauseProblem({
        ...base,
        pauses: [{ fromDate: "2026-11-24", toDate: "2026-11-28" }],
        from: "2026-11-20",
        to: "2026-11-25",
      }),
    ).toMatch(/Ya hay una pausa/);
  });

  it("no se solapa con días ya servidos", () => {
    expect(
      pauseProblem({ ...base, servedDates: ["2026-11-12"], from: "2026-11-12", to: "2026-11-14" }),
    ).toMatch(/Ya comió/);
  });
});

describe("precio del plan y estimado del mes", () => {
  const meals = [
    { type: "breakfast" as const, singlePrice: "5.00" },
    { type: "lunch" as const, singlePrice: "11.00" },
    { type: "dinner" as const, singlePrice: "8.00" },
  ];

  it("avisa si el plan cuesta más que sus comidas sueltas (no bloquea)", () => {
    expect(
      planPriceWarning({ meals: ["breakfast", "lunch", "dinner"], dailyPrice: "15.00" }, meals),
    ).toBeNull();
    expect(planPriceWarning({ meals: ["lunch"], dailyPrice: "12.00" }, meals)).toMatch(/S\/ 11.00/);
  });

  it("los días pausados no se cobran", () => {
    expect(
      monthEstimate({
        period: "2026-11",
        dailyPrice: "15.00",
        subscription: { startDate: "2026-11-01", endDate: null },
        pauses: [{ fromDate: "2026-11-20", toDate: "2026-11-24" }],
      }),
    ).toEqual({ days: 25, pausedDays: 5, amount: "375.00" });
  });

  it("solo cuenta los días del mes dentro de la afiliación", () => {
    expect(
      monthEstimate({
        period: "2026-11",
        dailyPrice: "10.00",
        subscription: { startDate: "2026-11-21", endDate: "2026-12-31" },
        pauses: [],
      }),
    ).toEqual({ days: 10, pausedDays: 0, amount: "100.00" });
    expect(
      monthEstimate({
        period: "2026-10",
        dailyPrice: "10.00",
        subscription: { startDate: "2026-11-21", endDate: null },
        pauses: [],
      }).days,
    ).toBe(0);
  });
});

describe("semana y cocina", () => {
  it("la semana va de lunes a domingo", () => {
    const week = weekOf("2026-11-12"); // jueves
    expect(week[0]).toBe("2026-11-09");
    expect(week[6]).toBe("2026-11-15");
  });

  it("solo se cocina para los que confirmaron", () => {
    const states = [
      { state: attendanceState({ paused: false, attendance: { confirmed: true } }), served: true },
      { state: attendanceState({ paused: false, attendance: { confirmed: true } }), served: false },
      { state: attendanceState({ paused: false, attendance: { confirmed: false } }), served: false },
      { state: attendanceState({ paused: false, attendance: null }), served: false },
      { state: attendanceState({ paused: true, attendance: null }), served: false },
    ];
    expect(kitchenCounts(states)).toEqual({ portions: 2, declined: 1, pending: 1, served: 1 });
  });
});
