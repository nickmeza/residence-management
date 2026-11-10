import { describe, expect, it } from "vitest";

import { issuesByPath } from "@/server/onboarding/schema";

import { EXAMPLE_BODY, templateSchema } from "./schemas";

const errors = (input: { name: string; body: string }) => {
  const parsed = templateSchema.safeParse(input);
  return parsed.success ? {} : issuesByPath(parsed.error);
};

describe("formulario de plantilla", () => {
  it("el texto de ejemplo es válido", () => {
    expect(errors({ name: "Contrato de alquiler", body: EXAMPLE_BODY })).toEqual({});
  });

  it("rechaza datos mal escritos y dice cuáles", () => {
    expect(errors({ name: "Contrato", body: "Yo, {nombr}, alquilo {unidad} desde {inicio}." })).toEqual({
      body: "No reconocemos: {nombr}, {inicio}. Revisa cómo está escrito.",
    });
  });

  it("pide nombre y un texto mínimo", () => {
    expect(errors({ name: "", body: "corto" })).toHaveProperty("name");
    expect(errors({ name: "", body: "corto" })).toHaveProperty("body");
  });
});
