import Link from "next/link";

// Pestañas de Configuración del prototipo. Las que todavía no existen aparecen como "pronto", sin enlace.
const TABS = [
  { label: "Negocio", path: "" },
  { label: "Usuarios y roles", path: null },
  { label: "Plantillas", path: "/plantillas" },
  { label: "Garantía", path: null },
  { label: "Documentos", path: null },
] as const;

export function ConfigTabs({
  businessId,
  current,
}: {
  businessId: string;
  current: "Negocio" | "Plantillas";
}) {
  return (
    <nav aria-label="Secciones de configuración" className="flex flex-wrap gap-2 border-b pb-3">
      {TABS.map((tab) =>
        tab.label === current ? (
          <span
            key={tab.label}
            aria-current="page"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {tab.label}
          </span>
        ) : tab.path !== null ? (
          <Link
            key={tab.label}
            href={`/negocio/${businessId}${tab.path}`}
            className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {tab.label}
          </Link>
        ) : (
          <span
            key={tab.label}
            aria-disabled="true"
            className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground opacity-60"
          >
            {tab.label} <span className="text-xs font-normal">(pronto)</span>
          </span>
        ),
      )}
    </nav>
  );
}
