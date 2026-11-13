"use client";

import { FileText, Home, ScrollText, ShieldCheck, Soup, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/mi", label: "Inicio", icon: Home },
  { href: "/mi/documentos", label: "Documentos", icon: FileText },
  { href: "/mi/pagos", label: "Pagos", icon: Wallet },
  { href: "/mi/contrato", label: "Contrato", icon: ScrollText },
  { href: "/mi/garantia", label: "Garantía", icon: ShieldCheck },
];

// "Pensión" aparece solo si la persona come en alguna pensión.
const linksFor = (pension: boolean) =>
  pension
    ? [...LINKS.slice(0, 3), { href: "/mi/pension", label: "Pensión", icon: Soup }, ...LINKS.slice(3)]
    : LINKS;

const isCurrent = (href: string, path: string) => (href === "/mi" ? path === "/mi" : path.startsWith(href));

// Menú lateral del residente en escritorio (igual que el del arrendador: a la izquierda, un ícono por opción).
export function ResidentSidebarNav({ pension = false }: { pension?: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Secciones">
      <ul className="flex flex-col gap-1">
        {linksFor(pension).map(({ href, label, icon: Icon }) => {
          const current = isCurrent(href, path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 " +
                  (current
                    ? "bg-primary-soft text-primary-text"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Navegación del residente: abajo en el celular (al alcance del pulgar), arriba en tablet.
export function ResidentNav({ pension = false }: { pension?: boolean }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-card sm:static sm:border-t-0 sm:bg-transparent"
    >
      <ul className="mx-auto flex max-w-2xl justify-around sm:justify-start sm:gap-2">
        {linksFor(pension).map(({ href, label, icon: Icon }) => {
          const current = isCurrent(href, path);
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
