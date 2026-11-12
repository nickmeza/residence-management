"use client";

import { FileText, Home, ScrollText, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/mi", label: "Inicio", icon: Home },
  { href: "/mi/documentos", label: "Documentos", icon: FileText },
  { href: "/mi/pagos", label: "Pagos", icon: Wallet },
  { href: "/mi/contrato", label: "Contrato", icon: ScrollText },
  { href: "/mi/garantia", label: "Garantía", icon: ShieldCheck },
] as const;

// Navegación del residente: abajo en el celular (al alcance del pulgar), arriba en pantallas grandes.
export function ResidentNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-card sm:static sm:border-t-0 sm:bg-transparent"
    >
      <ul className="mx-auto flex max-w-2xl justify-around sm:justify-start sm:gap-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const current = href === "/mi" ? path === "/mi" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-xs font-semibold transition-colors duration-200 sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-lg sm:text-sm " +
                  (current
                    ? "text-primary-text sm:bg-primary-soft"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="size-5 sm:size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
