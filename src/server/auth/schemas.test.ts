import { describe, expect, it } from "vitest";

import { safeNextPath, signInSchema } from "./schemas";

describe("signInSchema", () => {
  it("pide la contraseña", () => {
    const result = signInSchema.safeParse({ email: "a@b.pe", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("deja pasar rutas internas", () => {
    expect(safeNextPath("/panel")).toBe("/panel");
  });

  it("bloquea otras webs y valores vacíos", () => {
    for (const next of ["//malo.com", "https://malo.com", "/\\malo.com", "", null, undefined]) {
      expect(safeNextPath(next)).toBe("/panel");
    }
  });
});
