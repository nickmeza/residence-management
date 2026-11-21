import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

// Landing mínima: nombre, una frase y los botones para entrar. Los textos son ejemplos.
// Si ya hay sesión, /iniciar-sesion lleva directo al panel.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <p className="font-bold">Gestión de residencias</p>
        <ThemeToggle />
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">
          Tu residencia y tu pensión, <span className="text-primary">en un solo lugar</span>
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Cuartos, residentes, contratos, cobros, garantías, mantenimiento y comidas.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/iniciar-sesion" className={buttonVariants({ className: "h-11 px-6" })}>
            Iniciar sesión
          </Link>
          <Link href="/registro" className={buttonVariants({ variant: "outline", className: "h-11 px-6" })}>
            Crear cuenta
          </Link>
        </div>
        <Link href="/entrar" className="text-sm text-link underline-offset-4 hover:underline">
          Soy residente: entrar sin contraseña
        </Link>
      </section>
    </main>
  );
}
