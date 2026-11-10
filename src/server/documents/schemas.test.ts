import { describe, expect, it } from "vitest";

import { issuesByPath } from "@/server/onboarding/schema";

import { formatsHint, requirementSchema, type RequirementInput } from "./schemas";

const valid: RequirementInput = {
  name: "DNI",
  description: "",
  propertyId: "",
  required: true,
  acceptedFormats: ["pdf", "image"],
  maxSizeMb: "5",
};

const errors = (over: Partial<RequirementInput>) => {
  const parsed = requirementSchema.safeParse({ ...valid, ...over });
  return parsed.success ? {} : issuesByPath(parsed.error);
};

describe("requisito de documento", () => {
  it("sin propiedad vale para todo el negocio", () => {
    expect(requirementSchema.parse(valid)).toMatchObject({
      propertyId: null,
      description: null,
      maxSizeMb: 5,
    });
  });

  it("pide nombre, al menos un formato y un tamaño entre 1 y 20 MB", () => {
    expect(errors({ name: "" })).toHaveProperty("name");
    expect(errors({ acceptedFormats: [] })).toHaveProperty("acceptedFormats");
    expect(errors({ maxSizeMb: "50" })).toHaveProperty("maxSizeMb");
  });

  it("explica formatos y tamaño", () => {
    expect(formatsHint(["image", "pdf"], 5)).toBe("Foto o PDF, máximo 5 MB.");
  });
});
