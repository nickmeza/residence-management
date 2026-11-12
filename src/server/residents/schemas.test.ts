import { describe, expect, it } from "vitest";

import { issuesByPath } from "@/server/onboarding/schema";

import { residentSchema, splitResident, type ResidentInput } from "./schemas";

const empty: ResidentInput = {
  fullName: "Residente de Prueba",
  phone: "",
  email: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  university: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
};

const errors = (input: Partial<ResidentInput>) => {
  const parsed = residentSchema.safeParse({ ...empty, ...input });
  return parsed.success ? {} : issuesByPath(parsed.error);
};

describe("formulario de residente", () => {
  it("solo el nombre es obligatorio; lo vacío queda sin dato", () => {
    const data = residentSchema.parse(empty);
    expect(data.phone).toBeNull();
    expect(data.identityDocumentType).toBeNull();
    expect(errors({ fullName: " " })).toHaveProperty("fullName");
  });

  it("tipo y número de documento van juntos, y el DNI tiene 8 dígitos", () => {
    expect(errors({ identityDocumentType: "dni" })).toHaveProperty("identityDocumentNumber");
    expect(errors({ identityDocumentNumber: "12345678" })).toHaveProperty("identityDocumentType");
    expect(errors({ identityDocumentType: "dni", identityDocumentNumber: "1234" })).toHaveProperty(
      "identityDocumentNumber",
    );
    expect(errors({ identityDocumentType: "dni", identityDocumentNumber: "12345678" })).toEqual({});
    expect(errors({ identityDocumentType: "passport", identityDocumentNumber: "AB1234" })).toEqual({});
  });

  it("revisa el teléfono y el correo", () => {
    expect(errors({ phone: "987 654 321", email: "residente@ejemplo.com" })).toEqual({});
    expect(errors({ phone: "llámame" })).toHaveProperty("phone");
    expect(errors({ email: "sin-arroba" })).toHaveProperty("email");
  });

  it("separa los datos personales de los de la ficha del negocio", () => {
    const { personal, card } = splitResident(residentSchema.parse({ ...empty, university: "UNI" }));
    expect(Object.keys(personal).sort()).toEqual([
      "email",
      "fullName",
      "identityDocumentNumber",
      "identityDocumentType",
      "phone",
    ]);
    expect(card.university).toBe("UNI");
  });
});
