"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// El inicio usa todo el ancho (la portada va de borde a borde); las demás pantallas, una columna angosta.
export function ResidentMain({ children }: { children: ReactNode }) {
  const home = usePathname() === "/mi";
  return (
    <main
      className={
        home ? "flex w-full flex-col" : "mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5 lg:py-8"
      }
    >
      {children}
    </main>
  );
}
