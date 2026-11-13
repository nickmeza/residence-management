import Link from "next/link";

// Pestañas de Pensión. Las que todavía no existen se ven como "Pronto", sin enlace (se construyen por piezas).
const TABS = [
  { key: "hoy", label: "Hoy", href: null },
  { key: "comensales", label: "Comensales", href: null },
  { key: "pagos", label: "Pagos", href: null },
  { key: "menu", label: "Menú", href: null },
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
        ) : t.href ? (
          <Link
            key={t.key}
            href={t.href}
            className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {t.label}
          </Link>
        ) : (
          <span
            key={t.key}
            aria-disabled="true"
            className="flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground opacity-60"
          >
            {t.label}
            <span className="text-xs font-normal">Pronto</span>
          </span>
        ),
      )}
    </nav>
  );
}
