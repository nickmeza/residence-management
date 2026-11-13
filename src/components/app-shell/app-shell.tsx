import { Building2 } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials } from "@/lib/greeting";
import { getShellData } from "@/server/business/current";

import { MobileNav } from "./mobile-nav";
import { ShellBusinessSwitcher } from "./shell-business-switcher";
import { SidebarNav, type NavLinks } from "./sidebar-nav";

function Brand() {
  return (
    <Link href="/panel" className="flex items-center gap-3 px-1">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 className="size-5" aria-hidden="true" />
      </span>
      <span className="font-bold">Gestión de residencias</span>
    </Link>
  );
}

// Avatar abajo del menú: iniciales, nombre, rol y cerrar sesión.
function UserCard({ fullName }: { fullName: string }) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
          {initials(fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{fullName}</div>
          <div className="text-xs text-muted-foreground">Arrendador</div>
        </div>
        <ThemeToggle />
      </div>
      <SignOutButton />
    </div>
  );
}

const linksFor = (data: Awaited<ReturnType<typeof getShellData>>): NavLinks => {
  const current = data.current;
  const property = current?.service === "residence" ? current.properties[0] : undefined;
  return {
    edificio: property ? `/edificio/${property.id}` : null,
    pension: current?.service === "meal_plan" ? "/pension" : null,
    configuracion: current ? `/negocio/${current.id}` : null,
  };
};

// Lee la sesión: va dentro de <Suspense>.
async function Sidebar() {
  const data = await getShellData();
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav links={linksFor(data)} />
      </div>
      <UserCard fullName={data.fullName} />
    </>
  );
}

async function TopBar() {
  const data = await getShellData();
  const options = data.businesses.map((b) => ({ id: b.id, service: b.service, name: b.tradeName }));
  return (
    <>
      <MobileNav links={linksFor(data)} brand={<Brand />} footer={<UserCard fullName={data.fullName} />} />
      {data.current ? <ShellBusinessSwitcher options={options} currentId={data.current.id} /> : null}
    </>
  );
}

// Estructura de la app del arrendador: menú a la izquierda (en escritorio) y barra de arriba con el
// selector de negocio. En tablet y móvil el menú se abre desde la barra de arriba.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-card p-4 lg:flex">
        <Brand />
        <Suspense fallback={<p className="flex-1 px-3 text-sm text-muted-foreground">Cargando…</p>}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b bg-card px-4 sm:px-8">
          <Suspense fallback={<span className="text-sm text-muted-foreground">Cargando…</span>}>
            <TopBar />
          </Suspense>
        </header>
        <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-7 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
