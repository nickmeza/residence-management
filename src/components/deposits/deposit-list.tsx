"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { FilterMenu } from "@/components/filter-menu";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEPOSIT_FILTERS,
  filterDeposits,
  matchesDepositFilter,
  needsSettlement,
  type DepositFilter,
} from "@/server/deposits/list-filter";
import type { DepositListRow } from "@/server/deposits/queries";

import { DepositBadge } from "./deposit-badge";

const GRID = "grid grid-cols-[1.3fr_1.2fr_.9fr_1.2fr_1fr_auto] items-center gap-3 px-5";

// Lista de garantías (GA-07), versión simple (como Cobros): buscador, Filtrar y la tabla. "Liquidar" aparece
// cuando el contrato termina pronto o ya terminó.
export function DepositList({ rows, action }: { rows: DepositListRow[]; action?: ReactNode }) {
  const [filters, setFilters] = useState<DepositFilter[]>([]);
  const [query, setQuery] = useState("");
  const shown = filterDeposits(rows, filters, query);

  if (!rows.length) {
    return (
      <>
        <div className="flex justify-end">{action}</div>
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no hay garantías</h2>
          <p className="mt-1 text-muted-foreground">
            Se crean solas al confirmar un contrato, con lo que definas en Configuración › Garantía.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Buscar"
            type="search"
            placeholder="Buscar por residente o unidad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <FilterMenu
          options={DEPOSIT_FILTERS.map((f) => ({
            ...f,
            count: rows.filter((r) => matchesDepositFilter(r, f.id)).length,
          }))}
          selected={filters}
          onChange={setFilters}
        />
        <span className="hidden flex-1 sm:block" />
        {action}
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        {/* En móvil la tabla se desliza de lado. */}
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className={cn(
                GRID,
                "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Residente</span>
              <span>Unidad</span>
              <span>Garantía</span>
              <span>Estado</span>
              <span>Salida</span>
              <span className="sr-only">Acciones</span>
            </div>
            {shown.length ? (
              <ul>
                {shown.map((r) => {
                  const settleNow = needsSettlement(r);
                  return (
                    <li key={r.id} className={cn(GRID, "border-t py-3.5 text-sm")}>
                      <Link
                        href={`/residentes/${r.residentId}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {r.residentName}
                      </Link>
                      <span className="truncate">{r.unitName}</span>
                      <span>{r.phase === "none" ? "—" : formatSoles(r.amount)}</span>
                      <span>
                        <DepositBadge phase={r.phase} />
                        {r.phase === "returned" ? (
                          <span className="ml-2 text-muted-foreground">{formatSoles(r.refunded)}</span>
                        ) : null}
                      </span>
                      <span>{r.endsIn}</span>
                      <Link
                        href={`/garantias/${r.id}`}
                        className={buttonVariants({
                          variant: settleNow ? "default" : "outline",
                          className: "h-11",
                        })}
                      >
                        {settleNow ? "Liquidar" : "Ver"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                Ninguna garantía coincide con la búsqueda o el filtro.
              </p>
            )}
          </div>
        </div>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          Mostrando {shown.length} de {rows.length} {rows.length === 1 ? "garantía" : "garantías"}
        </p>
      </section>
    </>
  );
}
