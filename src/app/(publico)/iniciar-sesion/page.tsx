import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/auth-field";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Iniciar sesión · Gestión de residencias" };

// Aviso cuando el enlace del correo de confirmación falló (venció o ya se usó).
async function ConfirmationError({
  searchParams,
}: {
  searchParams: PageProps<"/iniciar-sesion">["searchParams"];
}) {
  const { error } = await searchParams;
  if (error !== "confirmacion") return null;
  return (
    <FormMessage message="El enlace de confirmación no es válido o ya venció. Inicia sesión o regístrate otra vez para recibir uno nuevo." />
  );
}

export default function SignInPage({ searchParams }: PageProps<"/iniciar-sesion">) {
  return (
    <AuthCard
      title="Iniciar sesión"
      description="Entra con tu correo y contraseña."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="text-link underline-offset-4 hover:underline">
            Crea una
          </Link>
          <br />
          ¿Eres residente?{" "}
          <Link href="/entrar" className="text-link underline-offset-4 hover:underline">
            Entra con tu correo
          </Link>
        </>
      }
    >
      {/* Los parámetros de la URL se leen en cada visita: van dentro de <Suspense>. */}
      <Suspense fallback={null}>
        <ConfirmationError searchParams={searchParams} />
      </Suspense>
      <SignInForm />
    </AuthCard>
  );
}
