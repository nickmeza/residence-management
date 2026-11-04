"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { firstFieldErrors, signInSchema, signUpSchema, type AuthFormState } from "./schemas";

// Acciones de servidor de los formularios de cuenta. Validan con Zod y llaman a Supabase Auth.
// Los mensajes de error de Supabase no se muestran tal cual: se traducen a algo claro.

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { fullName: raw.fullName, email: raw.email };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error), values };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // El trigger de la base lee full_name para crear la Persona.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/panel`,
    },
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "La contraseña es muy débil. Usa una más larga o con más variedad."
        : error.code === "over_email_send_rate_limit"
          ? "Se enviaron demasiados correos. Espera unos minutos y vuelve a intentarlo."
          : "No pudimos crear la cuenta. Vuelve a intentarlo.";
    return { status: "error", message, values };
  }

  // Supabase responde igual si el correo ya existía, para no revelar quién tiene cuenta.
  return { status: "check-email", values };
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { email: raw.email };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Todavía no confirmas tu correo. Revisa tu bandeja de entrada."
        : error.code === "invalid_credentials"
          ? "Correo o contraseña incorrectos."
          : "No pudimos iniciar sesión. Vuelve a intentarlo.";
    return { status: "error", message, values };
  }

  redirect("/panel");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/iniciar-sesion");
}
