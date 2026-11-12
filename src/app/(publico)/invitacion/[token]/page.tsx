import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/auth-field";
import { CodeSignInForm } from "@/components/auth/code-sign-in-form";
import { findOpenInvitation } from "@/server/residents/accept";

export const metadata: Metadata = { title: "Invitación · Gestión de residencias" };

const ERRORS: Record<string, string> = {
  "otra-cuenta":
    "Esta invitación ya la aceptó otra cuenta. Si fuiste tú, entra sin contraseña con tu correo.",
  "ya-esta": "Tu cuenta ya está en esta residencia. Entra sin contraseña con tu correo.",
  general: "No pudimos aceptar la invitación. Vuelve a intentarlo.",
};

const signInLink = (
  <>
    ¿Ya tienes cuenta?{" "}
    <Link href="/entrar" className="text-link underline-offset-4 hover:underline">
      Entra con tu correo
    </Link>
  </>
);

// Lo que abre el residente desde el enlace que le mandó su residencia (WhatsApp u otro medio).
async function Invitation({ params, searchParams }: PageProps<"/invitacion/[token]">) {
  const [{ token }, { error }] = await Promise.all([params, searchParams]);
  const invitation = await findOpenInvitation(token);
  const problem = typeof error === "string" ? (ERRORS[error] ?? ERRORS.general) : undefined;

  if (!invitation) {
    return (
      <AuthCard
        title="Este enlace ya no sirve"
        description="Ya se usó o venció. Pídele a tu residencia que te mande uno nuevo."
        footer={signInLink}
      >
        <FormMessage message={problem} />
      </AuthCard>
    );
  }

  const firstName = invitation.residentName.trim().split(/\s+/)[0];
  return (
    <AuthCard
      title={`Hola, ${firstName}`}
      description={`${invitation.businessName} te invita a ver tu contrato y tus documentos. No necesitas contraseña: te mandamos un enlace a tu correo para entrar.`}
      footer={signInLink}
    >
      <FormMessage message={problem} />
      <CodeSignInForm invite={token} defaultEmail={invitation.email ?? undefined} />
    </AuthCard>
  );
}

export default function InvitationPage(props: PageProps<"/invitacion/[token]">) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted-foreground">Cargando…</p>}>
      <Invitation {...props} />
    </Suspense>
  );
}
