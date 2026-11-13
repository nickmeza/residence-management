"use client";

import {
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Soup,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type NavLinks = { edificio: string | null; pension: string | null; configuracion: string | null };

type Item = { label: string; Icon: LucideIcon; href: string | null; match?: string; note?: string };

// Menú lateral (decisión del dueño: a la izquierda, con un ícono por opción).
// Las secciones de fases futuras aparecen como "Pronto", sin enlace.
export function SidebarNav({ links, onNavigate }: { links: NavLinks; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items: Item[] = [
    { label: "Panel", Icon: LayoutDashboard, href: "/panel" },
    {
      label: "Edificio",
      Icon: Building2,
      href: links.edificio,
      match: "/edificio",
      note: links.edificio ? undefined : "Solo Residencia",
    },
    { label: "Residentes", Icon: Users, href: "/residentes" },
    { label: "Contratos", Icon: FileText, href: "/contratos" },
    { label: "Cobros", Icon: Wallet, href: "/cobros" },
    { label: "Garantías", Icon: ShieldCheck, href: "/garantias" },
    {
      label: "Pensión",
      Icon: Soup,
      href: links.pension,
      match: "/pension",
      note: links.pension ? undefined : "Solo Pensión",
    },
    { label: "Mantenimiento", Icon: Wrench, href: null, note: "Pronto" },
    { label: "Configuración", Icon: Settings, href: links.configuracion, match: "/negocio/" },
  ];

  return (
    <nav aria-label="Menú principal">
      <ul className="flex flex-col gap-1">
        {items.map(({ label, Icon, href, match, note }) => {
          const active = href !== null && pathname.startsWith(match ?? href);
          const content = (
            <>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {note ? <span className="text-xs font-normal text-muted-foreground">{note}</span> : null}
            </>
          );
          const base =
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-200";
          return (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    base,
                    active
                      ? "bg-primary-soft text-primary-text"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={cn(base, "cursor-not-allowed text-muted-foreground opacity-60")}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
