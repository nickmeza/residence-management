"use client";

import { MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { FilterMenu } from "@/components/filter-menu";
import { Input } from "@/components/ui/input";
import { useListParams } from "@/components/use-list-params";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RequestRow } from "@/server/maintenance/queries";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_SLUGS,
  STATUS_VALUES,
  type MaintenanceStatus,
} from "@/server/maintenance/rules";

import { MaintenanceStatusBadge, PriorityBadge } from "./maintenance-badges";

const GRID = "grid grid-cols-[2fr_1fr_1fr_.9fr_.9fr_.8fr] items-center gap-3 px-5";

// Pedidos de mantenimiento (MT-02), versión simple como las demás listas: buscador, Filtrar y la tabla. Por defecto
// se ven los activos (pendientes y en curso), los urgentes primero.
// Sin filtro en la dirección, se ven los activos (pendientes y en curso).
const ACTIVE_BY_DEFAULT: MaintenanceStatus[] = ["open", "in_progress"];

export function MaintenanceList({
  rows,
  action,
  now,
}: {
  rows: RequestRow[];
  action?: ReactNode;
  now: Date;
}) {
  const { filters, setFilters, query, setQuery } = useListParams(STATUS_SLUGS, ACTIVE_BY_DEFAULT);
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!filters.length || filters.includes(r.status)) &&
      (!q || [r.title, r.unitName, r.residentName, r.assignee].some((v) => v?.toLowerCase().includes(q))),
  );

  if (!rows.length) {
    return (
      <>
        <div className="flex justify-end">{action}</div>
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no hay pedidos de mantenimiento</h2>
          <p className="mt-1 text-muted-foreground">
            Cuando un residente reporte algo desde su cuenta, aparecerá aquí y te llegará un aviso a la
            campanita.
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
            placeholder="Buscar por pedido, unidad o persona"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <FilterMenu
          options={STATUS_VALUES.map((s) => ({
            id: s,
            label: STATUS_LABEL[s],
            count: rows.filter((r) => r.status === s).length,
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
          <div className="min-w-[760px]">
            <div
              className={cn(
                GRID,
                "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Pedido</span>
              <span>Dónde</span>
              <span>Pidió</span>
              <span>Prioridad</span>
              <span>Estado</span>
              <span>Hace</span>
            </div>
            {shown.length ? (
              <ul>
                {shown.map((r) => (
                  <li key={r.id} className={cn(GRID, "border-t py-3.5 text-sm")}>
                    <span className="flex min-w-0 flex-col">
                      <Link
                        href={`/mantenimiento/${r.id}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {CATEGORY_LABEL[r.category]}
                        {r.comments ? (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="size-3" aria-hidden="true" />
                            {r.comments}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="truncate">
                      {r.unitName ?? "Área común"}
                      {r.blocksUnit && (r.status === "open" || r.status === "in_progress") ? (
                        <span className="block text-xs text-warn">Fuera de servicio</span>
                      ) : null}
                    </span>
                    <span className="truncate">{r.residentName ?? "Tú"}</span>
                    <span>
                      <PriorityBadge priority={r.priority} />
                    </span>
                    <span>
                      <MaintenanceStatusBadge status={r.status} />
                    </span>
                    <span className="text-muted-foreground">{formatTimeAgo(r.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                No hay pedidos con ese filtro.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
