// Invitación del residente: un enlace que el arrendador manda por WhatsApp o copia para cualquier otro medio.
// En la base solo se guarda el hash del enlace, nunca el enlace.
import { createHash, randomBytes } from "node:crypto";

// Días que dura una invitación. Es un ejemplo: el dueño puede cambiarlo.
export const INVITATION_DAYS = 7;

// 32 bytes al azar en base64url: imposible de adivinar y seguro dentro de una URL.
export const newInvitationToken = () => randomBytes(32).toString("base64url");

export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const invitationExpiry = (now: Date) => new Date(now.getTime() + INVITATION_DAYS * 86_400_000);

// El texto es un ejemplo: el dueño puede cambiarlo.
export function invitationMessage(input: { residentName: string; businessName: string; url: string }) {
  const firstName = input.residentName.trim().split(/\s+/)[0] ?? "";
  return [
    `Hola${firstName ? ` ${firstName}` : ""}, te invito a ${input.businessName}.`,
    `Desde aquí puedes ver tu contrato y tus documentos: ${input.url}`,
    `El enlace vence en ${INVITATION_DAYS} días.`,
  ].join("\n");
}

// Enlace de WhatsApp con el mensaje escrito. Un celular peruano (9 dígitos que empiezan con 9) recibe el
// código de país 51. Sin teléfono, WhatsApp deja elegir el contacto.
export function whatsappLink(phone: string | null, message: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (/^9\d{8}$/.test(digits)) digits = `51${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
