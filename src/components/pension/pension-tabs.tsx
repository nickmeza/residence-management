import Link from "next/link";

// Pestañas de Pensión: Hoy (cocina), Comensales, Pagos, Menú y Configuración.
const TABS = [
  { key: "hoy", label: "Hoy", href: "/pension/hoy" },
  { key: "comensales", label: "Comensales", href: "/pension/comensales" },
  { key: "pagos", label: "Pagos", href: "/pension/pagos" },
  { key: "menu", label: "Menú", href: "/pension/menu" },
  { key: "configuracion", label: "Configuración", href: "/pension/configuracion" },
] as const;

export type PensionTab = (typeof TABS)[number]["key"];

export function PensionTabs({ current }: { current: PensionTab }) {
  return (
    <nav aria-label="Secciones de la pensión" className="flex flex-wrap gap-2 border-b pb-3">
      {TABS.map((t) =>
        t.key === current ? (
          <span
            key={t.key}
            aria-current="page"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}
