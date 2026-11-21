import { describe, expect, it } from "vitest";

import { announcement, kitchenCancelled, mealTakeaway, paymentProof, paymentReviewed } from "./catalog";

describe("catálogo de notificaciones", () => {
  it("un comprobante en revisión es urgente; uno que se confirmó solo, no", () => {
    const review = paymentProof("Ana Ríos", "450", "2026-11", "r1", false);
    expect(review).toMatchObject({ type: "payment_proof", urgent: true, link: "/cobros/r1/2026-11" });
    expect(review.title).toContain("Ana Ríos");
    const auto = paymentProof("Ana Ríos", "450", "2026-11", "r1", true);
    expect(auto).toMatchObject({ type: "payment_auto_confirmed", urgent: false });
  });

  it("rechazar un pago confirmado es anularlo", () => {
    expect(paymentReviewed("450", "2026-11", "rejected", "Duplicado", true)).toMatchObject({
      type: "payment_voided",
    });
    expect(paymentReviewed("450", "2026-11", "rejected", "Ilegible", false).body).toContain("Ilegible");
  });

  it("la cocina pide disculpas cuando cancela y avisa del táper cuando el comensal avisó tarde", () => {
    expect(kitchenCancelled("lunch", "2026-11-16").title).toBe(
      "Disculpa: no habrá almuerzo el lunes 16 de noviembre",
    );
    expect(mealTakeaway("dinner", "2026-11-16").title).toBe("Tu cena está en táper, puedes recogerla");
  });

  it("un comunicado guarda solo la primera línea como título", () => {
    const n = announcement("Corte de agua\nsegunda línea", "Mañana de 9 a 12.", false);
    expect(n.title).toBe("Corte de agua");
    expect(n.link).toBe("/mi/avisos");
  });
});
