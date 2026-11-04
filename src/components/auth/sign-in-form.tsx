"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/server/auth/actions";
import type { AuthFormState } from "@/server/auth/schemas";

import { AuthField, FormMessage } from "./auth-field";

const initialState: AuthFormState = { status: "idle" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage message={state.message} />
      <AuthField
        name="email"
        label="Correo"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <AuthField
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Entrando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
