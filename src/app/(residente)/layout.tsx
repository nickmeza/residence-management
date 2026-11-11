import { SignOutButton } from "@/components/auth/sign-out-button";
import { ResidentNav } from "@/components/resident-side/resident-nav";
import { ThemeToggle } from "@/components/theme-toggle";

// Pantallas del residente. Pensadas primero para el celular: una columna y la navegación abajo.
export default function ResidenteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20 sm:pb-0">
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
        <ResidentNav />
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5">{children}</main>
    </div>
  );
}
