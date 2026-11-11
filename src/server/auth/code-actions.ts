"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { findOpenInvitation } from "@/server/residents/accept";

// Entrar sin contraseña: Supabase manda al correo un enlace (y un código de 6 dígitos cuando la plantilla del
// correo lo incluya, lo que exige correo propio/SMTP).
// Con invitación se puede crear la cuenta; sin invitación solo entra quien ya tiene una.

export type CodeFormState = {
  step: "email" | "code";
  email?: string;
  message?: string;
  error?: string;
};

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Escribe un correo válido." }));
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { error: "El código tiene 6 números." });

// Adónde ir después de entrar: con invitación, a aceptarla; si no, al inicio del residente.
const afterSignIn = (invite: string | null) => (invite ? `/invitacion/${invite}/aceptar` : "/mi");

export async function sendCodeAction(_prev: CodeFormState, formData: FormData): Promise<CodeFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const invite = (formData.get("invite") as string | null) || null;
  if (!parsed.success) return { step: "email", error: parsed.error.issues[0].message };
  const email = parsed.data;

  const invitation = invite ? await findOpenInvitation(invite) : null;
  if (invite && !invitation) {
    return {
      step: "email",
      email,
      error: "Este enlace ya se usó o venció. Pídele a tu residencia uno nuevo.",
    };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: Boolean(invitation),
      // El nombre que puso el arrendador: la base lo usa al crear la persona de la cuenta nueva.
      data: invitation ? { full_name: invitation.residentName } : undefined,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(afterSignIn(invite))}`,
    },
  });
  if (error) {
    const message =
      error.code === "otp_disabled" || error.code === "user_not_found" || error.status === 422
        ? "No encontramos una cuenta con ese correo. Si tu residencia te invitó, entra desde el enlace que te mandó."
        : error.status === 429
          ? "Se pidieron muchos correos seguidos. Espera unos minutos y vuelve a intentarlo."
          : "No pudimos enviar el correo. Vuelve a intentarlo.";
    return { step: "email", email, error: message };
  }
  return { step: "code", email, message: `Te enviamos un enlace a ${email} para entrar.` };
}

export async function verifyCodeAction(prev: CodeFormState, formData: FormData): Promise<CodeFormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const code = codeSchema.safeParse(formData.get("code"));
  const invite = (formData.get("invite") as string | null) || null;
  if (!email.success) return { step: "email", error: "Vuelve a escribir tu correo." };
  if (!code.success) return { ...prev, step: "code", email: email.data, error: code.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error) {
    return {
      step: "code",
      email: email.data,
      error: "El código no es correcto o ya venció. Revisa el último correo o pide uno nuevo.",
    };
  }
  redirect(afterSignIn(invite));
}
