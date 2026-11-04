"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { signUp } from "@/server/auth/actions";
import type { AuthFormState } from "@/server/auth/schemas";

import { AuthField, FormMessage } from "./auth-field";

const initialState: AuthFormState = { status: "idle" };

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);

  if (state.status === "check-email") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-bold text-ok">Revisa tu correo</p>
        <p className="text-sm">
          Si <b>{state.values?.email}</b> no tenía cuenta, te enviamos un enlace para activarla. Ábrelo y
          luego inicia sesión.
        </p>
        <Link href="/iniciar-sesion" className="text-sm text-link underline-offset-4 hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage message={state.message} />
      <AuthField
        name="fullName"
        label="Nombre completo"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />
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
        autoComplete="new-password"
        hint="Al menos 8 caracteres."
        error={state.fieldErrors?.password}
      />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
