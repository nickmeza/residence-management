import { Home } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials } from "@/lib/greeting";
import { hasMyPension } from "@/server/pension/queries";
import { getMyShell, type MyShell } from "@/server/residents/self";

import { ContactButtons } from "./contact-buttons";
import { ResidentMain } from "./resident-main";
import { ResidentNav, ResidentSidebarNav } from "./resident-nav";

function Brand() {
  return (
    <Link href="/mi" className="flex items-center gap-3 px-1">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Home className="size-5" aria-hidden="true" />
      </span>
      <span className="font-bold">Mi residencia</span>
    </Link>
  );
}

// "Tu residencia": a quién llamar o escribir. Un recuadro por negocio (puede estar en residencias de dueños distintos).
function ContactCard({ contact, firstName }: { contact: MyShell["contacts"][number]; firstName: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-3.5">
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Tu residencia</span>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-text">
          {initials(contact.businessName)}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">{contact.businessName}</span>
      </div>
      <ContactButtons phone={contact.phone} businessName={contact.businessName} firstName={firstName} />
    </div>
  );
}

// Avatar abajo del menú: iniciales, nombre, rol y cerrar sesión (igual que el arrendador).
function UserCard({ fullName }: { fullName: string }) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
          {initials(fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{fullName}</div>
          <div className="text-xs text-muted-foreground">Residente</div>
        </div>
        <ThemeToggle />
      </div>
      <SignOutButton />
    </div>
  );
}

// Lee la sesión: va dentro de <Suspense>.
async function Sidebar() {
  const [{ fullName, contacts }, pension] = await Promise.all([getMyShell(), hasMyPension()]);
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <ResidentSidebarNav pension={pension} />
        {contacts.map((c) => (
          <ContactCard key={c.businessId} contact={c} firstName={firstName} />
        ))}
      </div>
      <UserCard fullName={fullName} />
    </>
  );
}

// Navegación de tablet y celular; lee la sesión (por "Pensión"), así que va dentro de <Suspense>.
async function MobileNav() {
  return <ResidentNav pension={await hasMyPension()} />;
}

// Estructura de las pantallas del residente. En escritorio: menú a la izquierda (decisión del dueño).
// En tablet: barra de arriba con las secciones. En el celular: las secciones abajo, al alcance del pulgar.
export function ResidentShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-card p-4 lg:flex">
        <Brand />
        <Suspense fallback={<p className="flex-1 px-3 text-sm text-muted-foreground">Cargando…</p>}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 sm:pb-0">
        <div className="lg:hidden">
          <header className="border-b bg-card">
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-bold">Mi residencia</span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <SignOutButton />
              </div>
            </div>
          </header>
          <div className="mx-auto w-full max-w-2xl px-4 sm:pt-3">
            <Suspense fallback={<ResidentNav />}>
              <MobileNav />
            </Suspense>
          </div>
        </div>
        <ResidentMain>{children}</ResidentMain>
      </div>
    </div>
  );
}
