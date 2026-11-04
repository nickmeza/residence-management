import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta · Gestión de residencias" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Crear cuenta"
      description="Registra tu cuenta de arrendador para gestionar tu residencia."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/iniciar-sesion" className="text-link underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
