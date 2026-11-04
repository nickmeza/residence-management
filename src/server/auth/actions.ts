"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { firstFieldErrors, signInSchema, type AuthFormState } from "./schemas";

// Acciones de servidor de inicio y cierre de sesión. El registro está en src/server/onboarding/actions.ts.
// Validan con Zod y llaman a Supabase Auth. Los mensajes de error de Supabase no se muestran tal cual:
// se traducen a algo claro.

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
