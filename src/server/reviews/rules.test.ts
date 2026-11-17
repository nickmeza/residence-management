import { describe, expect, it } from "vitest";

import { canReview, reviewSummary } from "./rules";

const ended = { status: "confirmed" as const, endDate: "2026-11-10", renewed: false, reviewed: false };

describe("canReview", () => {
  it("deja calificar un contrato que ya terminó, una sola vez", () => {
    expect(canReview(ended, "2026-11-10")).toBe(true);
    expect(canReview(ended, "2026-11-20")).toBe(true);
    expect(canReview({ ...ended, reviewed: true }, "2026-11-20")).toBe(false);
  });

  it("no deja calificar antes del fin, sin fecha de fin, renovado o sin confirmar", () => {
    expect(canReview(ended, "2026-11-09")).toBe(false);
    expect(canReview({ ...ended, endDate: null }, "2026-11-20")).toBe(false);
    expect(canReview({ ...ended, renewed: true }, "2026-11-20")).toBe(false);
    expect(canReview({ ...ended, status: "cancelled" }, "2026-11-20")).toBe(false);
  });
});

describe("reviewSummary", () => {
  it("promedia cada rubro con un decimal y cuenta cuántos recomiendan", () => {
    const s = reviewSummary([
      { room: 5, cleaning: 4, treatment: 5, coexistence: 3, mealPlan: null, recommends: true },
      { room: 4, cleaning: 4, treatment: 4, coexistence: 4, mealPlan: 2, recommends: false },
      { room: 4, cleaning: 3, treatment: 5, coexistence: 5, mealPlan: null, recommends: true },
    ]);
    expect(s.count).toBe(3);
    expect(s.averages).toEqual({ room: 4.3, cleaning: 3.7, treatment: 4.7, coexistence: 4, mealPlan: 2 });
    expect(s.recommendPercent).toBe(67);
  });

  it("sin reseñas no inventa promedios", () => {
    const s = reviewSummary([]);
    expect(s.averages.room).toBeNull();
    expect(s.recommendPercent).toBeNull();
  });
});
