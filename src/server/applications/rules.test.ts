import { describe, expect, it } from "vitest";

import { applicationMoves, isRepeated, normalizePhone } from "./rules";

describe("postulantes", () => {
  it("el mismo celular con o sin +51 y espacios es el mismo", () => {
    expect(normalizePhone("+51 987 654 321")).toBe("987654321");
    expect(normalizePhone("987-654-321")).toBe("987654321");
  });

  it("no deja postular dos veces en 24 horas con el mismo celular", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const before = [{ phone: "987654321", createdAt: new Date("2026-11-15T02:00:00Z") }];
    expect(isRepeated(before, "+51 987 654 321", now)).toBe(true);
    expect(isRepeated(before, "912345678", now)).toBe(false);
    expect(isRepeated(before, "987654321", new Date("2026-11-16T03:00:00Z"))).toBe(false);
  });

  it("una aprobada no vuelve atrás; una rechazada puede pasar a la lista de espera", () => {
    expect(applicationMoves("approved")).toEqual([]);
    expect(applicationMoves("rejected")).toEqual(["waitlist"]);
    expect(applicationMoves("new")).toEqual(["waitlist", "approved", "rejected"]);
  });
});
