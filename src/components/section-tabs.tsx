import Link from "next/link";

export type SectionTab = { key: string; label: string; href: string };

// Pestañas de una sección (Mantenimiento, Visitas y paquetes, Reportes), como las de Pensión.
export function SectionTabs({
  tabs,
  current,
  label,
}: {
  tabs: SectionTab[];
  current: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 border-b pb-3">
      {tabs.map((t) =>
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

export const MAINTENANCE_TABS: SectionTab[] = [
  { key: "pedidos", label: "Pedidos", href: "/mantenimiento" },
  { key: "preventivo", label: "Preventivo", href: "/mantenimiento/preventivo" },
  { key: "limpieza", label: "Limpieza", href: "/mantenimiento/limpieza" },
  { key: "proveedores", label: "Proveedores", href: "/mantenimiento/proveedores" },
];

export const RECEPTION_TABS: SectionTab[] = [
  { key: "visitas", label: "Visitas", href: "/visitas" },
  { key: "paquetes", label: "Paquetes", href: "/visitas/paquetes" },
];

export const REPORT_TABS: SectionTab[] = [
  { key: "numeros", label: "Números", href: "/reportes" },
  { key: "resenas", label: "Reseñas", href: "/reportes/resenas" },
];
