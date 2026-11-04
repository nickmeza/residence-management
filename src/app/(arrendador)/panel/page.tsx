import type { Metadata } from "next";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentPerson } from "@/server/auth/session";

export const metadata: Metadata = { title: "Panel · Gestión de residencias" };

// Lee la sesión y la Persona (con RLS); por eso va dentro de <Suspense>.
async function Greeting() {
  const me = await getCurrentPerson();
  return <h1 className="text-[34px] font-bold tracking-tight">Hola, {me.fullName}</h1>;
}

// Panel mínimo de la Fase 1: solo comprueba que la cuenta y su Persona están conectadas.
export default function PanelPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Panel del arrendador</p>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Cargando tu panel…</p>}>
        <Greeting />
      </Suspense>
      <p className="text-muted-foreground">
        Todavía no tienes propiedades. Podrás registrarlas en la Fase 2.
      </p>
    </main>
  );
}
