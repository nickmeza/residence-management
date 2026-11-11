import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { CodeSignInForm } from "@/components/auth/code-sign-in-form";

export const metadata: Metadata = { title: "Entrar sin contraseña · Gestión de residencias" };

// Entrada de los residentes: sin contraseña, con un enlace al correo.
export default function CodeSignInPage() {
  return (
    <AuthCard
      title="Entrar sin contraseña"
      description="Escribe el correo con el que aceptaste la invitación de tu residencia. Te mandamos un enlace para entrar."
      footer={
        <>
          ¿Administras una residencia?{" "}
          <Link href="/iniciar-sesion" className="text-link underline-offset-4 hover:underline">
            Entra con tu contraseña
          </Link>
        </>
      }
    >
      <CodeSignInForm />
    </AuthCard>
  );
}
