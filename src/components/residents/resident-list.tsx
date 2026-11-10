"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/greeting";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { matchesFilter, matchesSearch, type ResidentFilter } from "@/server/residents/list";
import type { ResidentListRow } from "@/server/residents/queries";

import { ContractPhaseBadge, DocumentsBadge } from "./badges";
import { ResidentSheet, type ResidentSheetTarget } from "./resident-sheet";

const FILTERS: { id: ResidentFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "ending_soon", label: "Por vencer" },
  { id: "documents", label: "Documentos pendientes" },
];

// Columnas de la tabla, como el prototipo (sin "Pagos": llega con los cobros en la Fase 5).
const GRID = "grid grid-cols-[1.7fr_1.3fr_.8fr_1fr_1.1fr_1.1fr_auto] items-center gap-3 px-5";

export function AddResidentButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" className="h-11 gap-2" onClick={onClick}>
      <Plus className="size-4" aria-hidden="true" />
      Agregar residente
    </Button>
  );
}

// Lista de residentes con filtros, buscador y el panel para agregar.
export function ResidentList({ rows }: { rows: ResidentListRow[] }) {
  const [filter, setFilter] = useState<ResidentFilter>("all");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<ResidentSheetTarget | null>(null);
  const shown = rows.filter((r) => matchesFilter(r, filter) && matchesSearch(r, query));
  const count = (f: ResidentFilter) => rows.filter((r) => matchesFilter(r, f)).length;
  const openCreate = () => setSheet({ mode: "create" });

  const panel = <ResidentSheet target={sheet} onClose={() => setSheet(null)} />;

  if (!rows.length) {
    return (
      <>
        <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no tienes residentes</h2>
          <p className="text-muted-foreground">
            Agrega a quienes viven en tu propiedad. Solo necesitas su nombre; luego puedes invitarlos para que
            vean su contrato desde el celular.
          </p>
          <AddResidentButton onClick={openCreate} />
        </section>
        {panel}
      </>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-2.5 p-4 sm:px-5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-10 rounded-lg px-3.5 text-sm font-semibold transition-colors duration-200",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card text-foreground hover:bg-muted",
              )}
            >
              {f.label} {count(f.id)}
            </button>
          ))}
          <span className="hidden flex-1 sm:block" />
          <div className="relative w-full sm:max-w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Buscar"
              type="search"
              placeholder="Buscar por nombre o unidad"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>
        {/* En móvil la tabla se desliza de lado. */}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className={cn(
                GRID,
                "border-t bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Residente</span>
              <span>Unidad</span>
              <span>Renta</span>
              <span>Contrato vence</span>
              <span>Contrato</span>
              <span>Documentos</span>
              <span className="sr-only">Acciones</span>
            </div>
            {shown.length ? (
              <ul>
                {shown.map((r) => (
                  <li key={r.id} className={cn(GRID, "border-t py-3.5 text-sm")}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
                        {initials(r.fullName)}
                      </span>
                      <span className="min-w-0">
                        <b className="block truncate">{r.fullName}</b>
                        {r.isStudent ? <span className="text-muted-foreground">Estudiante</span> : null}
                      </span>
                    </span>
                    <span>{r.unitName ?? <span className="text-muted-foreground">—</span>}</span>
                    <span>
                      {formatSoles(r.monthlyRent) ?? <span className="text-muted-foreground">—</span>}
                    </span>
                    <span>{r.endsIn ?? <span className="text-muted-foreground">—</span>}</span>
                    <span>
                      <ContractPhaseBadge phase={r.phase} />
                    </span>
                    <span>
                      <DocumentsBadge summary={r.documents} />
                    </span>
                    <Link
                      href={`/residentes/${r.id}`}
                      className={buttonVariants({ variant: "outline", className: "h-11" })}
                    >
                      Ver perfil
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                Nadie coincide con ese filtro o búsqueda.
              </p>
            )}
          </div>
        </div>
      </section>
      <div>
        <AddResidentButton onClick={openCreate} />
      </div>
      {panel}
    </>
  );
}
