import { describe, expect, it } from "vitest";

import { formatSoles } from "./format";

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
