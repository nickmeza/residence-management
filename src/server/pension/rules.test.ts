import { describe, expect, it } from "vitest";

import {
  attendanceState,
  cancelDeadline,
  cancellationOpen,
  coversDay,
  isPaused,
  isServiceDay,
  isoWeekday,
  kitchenCounts,
  kitchenProblem,
  limaNow,
  nearestServiceDay,
  nextCoverage,
  overlapsSubscription,
  pauseProblem,
  pauseRemovable,
  pensionAccount,
  planPriceWarning,
  rangeCost,
  weekOf,
} from "./rules";

describe("cancelación (regla 12, decisión del dueño: por defecto se cocina)", () => {
  it("se cancela hasta la hora límite del día anterior", () => {
    expect(cancelDeadline("2026-11-13", "20:00:00")).toBe("2026-11-12T20:00");
    expect(cancelDeadline("2026-12-01", "21:30")).toBe("2026-11-30T21:30");
  });

  it("antes de la hora se puede cambiar; desde la hora, ya no", () => {
    const deadline = "2026-11-12T20:00";
    expect(cancellationOpen("2026-11-12T19:59", deadline)).toBe(true);
    expect(cancellationOpen("2026-11-12T20:00", deadline)).toBe(false);
    expect(cancellationOpen("2026-11-13T08:00", deadline)).toBe(false);
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

describe("cobro por adelantado", () => {
  const meals = [
    { type: "breakfast" as const, singlePrice: "5.00" },
    { type: "lunch" as const, singlePrice: "11.00" },
    { type: "dinner" as const, singlePrice: "8.00" },
  ];
  const sub = { startDate: "2026-11-16", endDate: null };
  const base = { dailyPrice: "15.00", mealsPerDay: 3, subscription: sub, pauses: [], cancelledOnTime: [] };

  it("avisa si el plan cuesta más que sus comidas sueltas (no bloquea)", () => {
    expect(
      planPriceWarning({ meals: ["breakfast", "lunch", "dinner"], dailyPrice: "15.00" }, meals),
    ).toBeNull();
    expect(planPriceWarning({ meals: ["lunch"], dailyPrice: "12.00" }, meals)).toMatch(/S\/ 11.00/);
  });

  it("una semana: los días pausados no se cobran y una comida cancelada a tiempo tampoco", () => {
    expect(rangeCost({ ...base, from: "2026-11-16", to: "2026-11-22" })).toEqual({
      days: 7,
      amount: "105.00",
    });
    expect(
      rangeCost({
        ...base,
        from: "2026-11-16",
        to: "2026-11-22",
        pauses: [{ fromDate: "2026-11-21", toDate: "2026-11-22" }],
        cancelledOnTime: ["2026-11-18"],
      }),
    ).toEqual({ days: 5, amount: "70.00" });
  });

  it("el próximo pago cubre un día, una semana o un mes", () => {
    expect(nextCoverage("2026-11-16", "daily")).toEqual({ from: "2026-11-16", to: "2026-11-16" });
    expect(nextCoverage("2026-11-16", "weekly")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(nextCoverage("2026-11-16", "monthly")).toEqual({ from: "2026-11-16", to: "2026-12-15" });
  });

  it("estado de cuenta: pagado hasta, saldo a favor por cancelar y lo sugerido para la próxima semana", () => {
    const account = pensionAccount({
      ...base,
      today: "2026-11-18",
      cycle: "weekly",
      cancelledOnTime: ["2026-11-17"],
      payments: [{ amount: "105.00", coversTo: "2026-11-22" }],
    });
    expect(account.paidUntil).toBe("2026-11-22");
    expect(account.balance).toBe("5.00");
    expect(account.upToDate).toBe(true);
    expect(account.next).toEqual({ from: "2026-11-23", to: "2026-11-29", amount: "100.00" });
  });

  it("días de atención: de lunes a viernes, el sábado y el domingo no se cobran", () => {
    // 2026-11-16 es lunes.
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
    expect(isServiceDay("2026-11-21", [1, 2, 3, 4, 5])).toBe(false);
    expect(isServiceDay("2026-11-20", [1, 2, 3, 4, 5])).toBe(true);
    expect(
      rangeCost({ ...base, from: "2026-11-16", to: "2026-11-22", serviceDays: [1, 2, 3, 4, 5] }),
    ).toEqual({ days: 5, amount: "75.00" });
    // Lo sugerido para la semana también cuenta solo los días que se cocina.
    const account = pensionAccount({
      ...base,
      today: "2026-11-16",
      cycle: "weekly",
      serviceDays: [1, 2, 3, 4, 5],
      payments: [],
    });
    expect(account.next).toEqual({ from: "2026-11-16", to: "2026-11-22", amount: "75.00" });
  });

  it("pagos por partes: 'pagado hasta' avanza solo con el tramo completo y se sugiere lo que falta", () => {
    // La semana del 16 al 22 cuesta S/ 105 (S/ 15 al día). Pagó S/ 40 y luego S/ 65.
    const first = pensionAccount({
      ...base,
      today: "2026-11-16",
      cycle: "weekly",
      payments: [{ amount: "40.00", coversTo: "2026-11-22" }],
    });
    expect(first.paidUntil).toBe("2026-11-17"); // S/ 40 alcanza para 2 días (S/ 30)
    expect(first.partial).toEqual({ from: "2026-11-18", to: "2026-11-22", missing: "65.00" });
    expect(first.next).toEqual({ from: "2026-11-18", to: "2026-11-22", amount: "65.00" });
    const done = pensionAccount({
      ...base,
      today: "2026-11-16",
      cycle: "weekly",
      payments: [
        { amount: "40.00", coversTo: "2026-11-22" },
        { amount: "65.00", coversTo: "2026-11-22" },
      ],
    });
    expect(done.paidUntil).toBe("2026-11-22");
    expect(done.partial).toBeNull();
    expect(done.next).toEqual({ from: "2026-11-23", to: "2026-11-29", amount: "105.00" });
  });

  it("sin pagos debe desde el inicio", () => {
    const account = pensionAccount({ ...base, today: "2026-11-17", cycle: "daily", payments: [] });
    expect(account.paidUntil).toBeNull();
    expect(account.balance).toBe("-30.00");
    expect(account.upToDate).toBe(false);
    // El próximo pago cubre lo que debe (16 y 17) sin contarlo dos veces.
    expect(account.next).toEqual({ from: "2026-11-16", to: "2026-11-17", amount: "30.00" });
  });
});

describe("semana y cocina", () => {
  it("la semana va de lunes a domingo", () => {
    const week = weekOf("2026-11-12"); // jueves
    expect(week[0]).toBe("2026-11-09");
    expect(week[6]).toBe("2026-11-15");
  });

  it("se cocina para todos menos los que cancelaron o pausaron", () => {
    const states = [
      { state: attendanceState({ paused: false, attendance: null }), served: true },
      { state: attendanceState({ paused: false, attendance: null }), served: false },
      { state: attendanceState({ paused: false, attendance: { cancelled: false } }), served: false },
      { state: attendanceState({ paused: false, attendance: { cancelled: true } }), served: false },
      { state: attendanceState({ paused: true, attendance: null }), served: false },
    ];
    expect(kitchenCounts(states)).toEqual({ portions: 3, cancelled: 1, served: 1 });
  });
});

describe("una afiliación a la vez", () => {
  const open = { startDate: "2026-11-01", endDate: null };
  it("se cruza con una abierta o con fechas que se tocan", () => {
    expect(overlapsSubscription({ startDate: "2026-12-01", endDate: null }, [open])).toBe(true);
    expect(
      overlapsSubscription({ startDate: "2026-10-01", endDate: "2026-11-01" }, [
        { startDate: "2026-11-01", endDate: "2026-11-30" },
      ]),
    ).toBe(true);
  });
  it("no se cruza si la anterior terminó antes", () => {
    expect(
      overlapsSubscription({ startDate: "2026-12-01", endDate: null }, [
        { startDate: "2026-11-01", endDate: "2026-11-30" },
      ]),
    ).toBe(false);
    expect(overlapsSubscription({ startDate: "2026-12-01", endDate: null }, [])).toBe(false);
  });
});

describe("la cocina marca o cancela una comida", () => {
  const subscription = { startDate: "2026-11-01", endDate: null, planMeals: ["lunch" as const] };
  it("solo si su plan la incluye ese día y no está en pausa", () => {
    expect(kitchenProblem({ date: "2026-11-10", meal: "lunch", subscription, pauses: [] })).toBeNull();
    expect(kitchenProblem({ date: "2026-11-10", meal: "dinner", subscription, pauses: [] })).toMatch(
      /no incluye/,
    );
    expect(kitchenProblem({ date: "2026-10-31", meal: "lunch", subscription, pauses: [] })).toMatch(
      /no incluye/,
    );
    expect(kitchenProblem({ date: "2026-11-10", meal: "lunch", subscription: null, pauses: [] })).toMatch(
      /no incluye/,
    );
    expect(
      kitchenProblem({
        date: "2026-11-10",
        meal: "lunch",
        subscription,
        pauses: [{ fromDate: "2026-11-09", toDate: "2026-11-12" }],
      }),
    ).toMatch(/pausa/);
  });
  it("una pausa se quita solo si todavía no empezó", () => {
    expect(pauseRemovable({ fromDate: "2026-11-14" }, "2026-11-13")).toBe(true);
    expect(pauseRemovable({ fromDate: "2026-11-13" }, "2026-11-13")).toBe(false);
  });
});

describe("días sin servicio: no se muestran (decisión del dueño, 2026-11-13)", () => {
  it("las flechas saltan los días que no se cocina", () => {
    const weekdays = [1, 2, 3, 4, 5]; // lunes a viernes
    expect(nearestServiceDay("2026-11-13", 1, weekdays)).toBe("2026-11-16"); // viernes → lunes
    expect(nearestServiceDay("2026-11-16", -1, weekdays)).toBe("2026-11-13"); // lunes → viernes
    expect(nearestServiceDay("2026-11-11", 1, weekdays)).toBe("2026-11-12");
  });
});
