import { describe, expect, it } from "vitest";

import { firstFieldErrors, safeNextPath, signInSchema, signUpSchema } from "./schemas";

describe("signUpSchema", () => {
  it("acepta datos válidos y normaliza el correo", () => {
    const result = signUpSchema.parse({
      fullName: "  Ana Pérez ",
      email: " Ana@Ejemplo.PE ",
      password: "12345678",
    });
    expect(result).toEqual({ fullName: "Ana Pérez", email: "ana@ejemplo.pe", password: "12345678" });
  });

  it("rechaza nombre corto, correo inválido y contraseña corta, con mensajes en español", () => {
    const result = signUpSchema.safeParse({ fullName: "A", email: "no-es-correo", password: "123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstFieldErrors(result.error)).toEqual({
        fullName: "Escribe tu nombre completo.",
        email: "Escribe un correo válido.",
        password: "La contraseña debe tener al menos 8 caracteres.",
      });
    }
  });

  it("rechaza contraseñas de más de 72 caracteres", () => {
    const result = signUpSchema.safeParse({ fullName: "Ana", email: "a@b.pe", password: "x".repeat(73) });
    expect(result.success).toBe(false);
  });
});

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
