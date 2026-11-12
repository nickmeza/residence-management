import { describe, expect, it } from "vitest";

import { mergePersonData } from "./merge";

const empty = {
  fullName: "",
  email: null,
  phone: null,
  identityDocumentType: null,
  identityDocumentNumber: null,
};

describe("unir datos al aceptar la invitación", () => {
  const invited = {
    fullName: "María Pérez",
    email: "maria.vieja@correo.test",
    phone: "999111222",
    identityDocumentType: "dni" as const,
    identityDocumentNumber: "12345678",
  };

  it("ganan los datos del residente", () => {
    const account = {
      fullName: "María Fernanda Pérez",
      email: "maria@correo.test",
      phone: "988777666",
      identityDocumentType: "passport" as const,
      identityDocumentNumber: "AB123",
    };
    expect(mergePersonData(account, invited, "maria@correo.test")).toEqual({
      fullName: "María Fernanda Pérez",
      email: "maria@correo.test",
      phone: "988777666",
      identityDocumentType: "passport",
      identityDocumentNumber: "AB123",
    });
  });

  it("lo que le falta al residente se completa con lo del arrendador", () => {
    expect(mergePersonData({ ...empty, fullName: "María" }, invited, "maria@correo.test")).toEqual({
      fullName: "María",
      email: "maria@correo.test",
      phone: "999111222",
      identityDocumentType: "dni",
      identityDocumentNumber: "12345678",
    });
  });

  it("sin nombre en la cuenta usa el del arrendador", () => {
    expect(mergePersonData(empty, invited, null).fullName).toBe("María Pérez");
  });
});
