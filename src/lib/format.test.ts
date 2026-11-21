import { describe, expect, it } from "vitest";

import { formatSoles, formatTimeAgo } from "./format";

describe("formatSoles", () => {
  it("muestra soles como el prototipo", () => {
    expect(formatSoles("1800")).toBe("S/ 1,800");
    expect(formatSoles("650.5")).toBe("S/ 650.5");
    expect(formatSoles(600)).toBe("S/ 600");
  });

  it("devuelve null si no hay monto", () => {
    expect(formatSoles("")).toBeNull();
    expect(formatSoles(null)).toBeNull();
    expect(formatSoles("abc")).toBeNull();
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-11-15T15:00:00Z");
  const ago = (ms: number) => formatTimeAgo(new Date(now.getTime() - ms), now);

  it("dice hace cuánto en minutos, horas o ayer", () => {
    expect(ago(20_000)).toBe("hace un momento");
    expect(ago(5 * 60_000)).toBe("hace 5 min");
    expect(ago(3 * 3_600_000)).toBe("hace 3 h");
    expect(ago(30 * 3_600_000)).toBe("ayer");
  });

  it("después de dos días muestra la fecha de Lima", () => {
    expect(ago(3 * 86_400_000)).toMatch(/^12 nov/);
  });
});
