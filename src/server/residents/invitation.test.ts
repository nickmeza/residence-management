import { describe, expect, it } from "vitest";

import {
  hashInvitationToken,
  invitationExpiry,
  invitationMessage,
  newInvitationToken,
  whatsappLink,
} from "./invitation";

describe("invitación del residente", () => {
  it("cada enlace es distinto y su hash no lo revela", () => {
    const a = newInvitationToken();
    expect(a).not.toBe(newInvitationToken());
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashInvitationToken(a)).toBe(hashInvitationToken(a));
    expect(hashInvitationToken(a)).not.toContain(a);
  });

  it("vence a los 7 días", () => {
    expect(invitationExpiry(new Date("2026-03-01T12:00:00Z")).toISOString()).toBe("2026-03-08T12:00:00.000Z");
  });

  it("el mensaje saluda por el primer nombre e incluye el enlace", () => {
    const text = invitationMessage({
      residentName: "Residente de Prueba",
      businessName: "Residencia de ejemplo",
      url: "http://localhost:3000/invitacion/abc",
    });
    expect(text).toContain("Hola Residente, te invito a Residencia de ejemplo.");
    expect(text).toContain("http://localhost:3000/invitacion/abc");
  });

  it("el enlace de WhatsApp agrega el 51 a un celular peruano", () => {
    expect(whatsappLink("987 654 321", "Hola")).toBe("https://wa.me/51987654321?text=Hola");
    expect(whatsappLink("+51 987654321", "Hola")).toBe("https://wa.me/51987654321?text=Hola");
    expect(whatsappLink(null, "Hola y chau")).toBe("https://wa.me/?text=Hola%20y%20chau");
  });
});
