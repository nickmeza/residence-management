"use client";

import Link from "next/link";
import { useState } from "react";

import { FilterMenu } from "@/components/filter-menu";
import { ApplicationBadge } from "./application-badge";
import { formatShortDate, formatSoles, formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApplicationRow } from "@/server/applications/queries";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_VALUES,
  type ApplicationStatus,
} from "@/server/applications/rules";

const GRID = "grid grid-cols-[1.5fr_1fr_1fr_.9fr_.9fr] items-center gap-3 px-5";
const TYPE = { room: "Cuarto", apartment: "Departamento" } as const;

// Postulantes (RS-04, RS-05): por defecto las nuevas y la lista de espera.
export function ApplicationList({ rows, now }: { rows: ApplicationRow[]; now: Date }) {
  const [filters, setFilters] = useState<ApplicationStatus[]>(["new", "waitlist"]);
  const shown = rows.filter((r) => !filters.length || filters.includes(r.status));

  if (!rows.length) {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Todavía no hay postulaciones</h2>
        <p className="mt-1 text-muted-foreground">
          Prende el enlace de arriba y compártelo. Cada postulación te llegará a la campanita.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterMenu
          options={APPLICATION_STATUS_VALUES.map((s) => ({
            id: s,
            label: APPLICATION_STATUS_LABEL[s],
            count: rows.filter((r) => r.status === s).length,
          }))}
          selected={filters}
          onChange={setFilters}
        />
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        {/* En móvil la tabla se desliza de lado. */}
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div
              className={cn(
                GRID,
                "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Postulante</span>
              <span>Busca</span>
              <span>Desde</span>
              <span>Estado</span>
              <span>Llegó</span>
            </div>
            {shown.length ? (
              <ul>
                {shown.map((r) => (
                  <li key={r.id} className={cn(GRID, "border-t py-3.5 text-sm")}>
                    <span className="flex min-w-0 flex-col">
                      <Link href={`/postulantes/${r.id}`} className="truncate font-semibold hover:underline">
                        {r.fullName}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">{r.phone}</span>
                    </span>
                    <span>
                      {r.unitType ? TYPE[r.unitType] : "Cualquiera"}
                      {r.budget ? (
                        <span className="block text-xs text-muted-foreground">{formatSoles(r.budget)}</span>
                      ) : null}
                    </span>
                    <span>{r.moveInDate ? formatShortDate(r.moveInDate) : "—"}</span>
                    <span>
                      <ApplicationBadge status={r.status} />
                    </span>
                    <span className="text-muted-foreground">{formatTimeAgo(r.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                No hay postulaciones con ese filtro.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
