"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DepositListRow } from "@/server/deposits/queries";
import type { DepositPhase } from "@/server/deposits/rules";

import { DepositBadge } from "./deposit-badge";

type Filter = "all" | "held" | "settling" | "returned";

const FILTERS: { id: Filter; label: string; phases: DepositPhase[] | null }[] = [
  { id: "all", label: "Todas", phases: null },
  { id: "held", label: "Retenidas", phases: ["held", "unpaid"] },
  { id: "settling", label: "En liquidación", phases: ["settling", "disputed"] },
  { id: "returned", label: "Devueltas", phases: ["returned"] },
];

const GRID = "grid grid-cols-[1.3fr_1.2fr_.9fr_1.2fr_1fr_auto] items-center gap-3 px-5";

// Lista de garantías (GA-07) con filtros. "Liquidar" aparece cuando el contrato termina pronto o ya terminó.
export function DepositList({ rows }: { rows: DepositListRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const matches = (phase: DepositPhase, f: Filter) => {
    const phases = FILTERS.find((x) => x.id === f)!.phases;
    return phases === null || phases.includes(phase);
  };
  const shown = rows.filter((r) => matches(r.phase, filter));

  if (!rows.length) {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Todavía no hay garantías</h2>
        <p className="mt-1 text-muted-foreground">
          Se crean solas al confirmar un contrato, con lo que definas en Configuración › Garantía.
        </p>
      </section>
    );
  }

  return (
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
              filter === f.id ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-muted",
            )}
          >
            {f.label} {rows.filter((r) => matches(r.phase, f.id)).length}
          </button>
        ))}
      </div>
      {/* En móvil la tabla se desliza de lado. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className={cn(
              GRID,
              "border-t bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
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
                const settleNow =
                  (r.phase === "held" || r.phase === "settling" || r.phase === "disputed") &&
                  (r.contractPhase === "ending_soon" || r.contractPhase === "ended");
                return (
                  <li key={r.id} className={cn(GRID, "border-t py-3.5 text-sm")}>
                    <span className="truncate font-semibold">{r.residentName}</span>
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
              Ninguna garantía coincide con ese filtro.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
