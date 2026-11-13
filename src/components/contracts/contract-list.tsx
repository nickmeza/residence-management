"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FilterMenu } from "@/components/filter-menu";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CONTRACT_FILTERS,
  filterContracts,
  matchesContractFilter,
  type ContractFilter,
} from "@/server/contracts/list-filter";
import type { ContractFormOptions, ContractListRow } from "@/server/contracts/queries";
import { PAPERWORK_LABEL } from "@/server/contracts/schemas";

import { ContractSheet, type ContractSheetTarget } from "./contract-sheet";

const GRID = "grid grid-cols-[1.3fr_1.3fr_.8fr_1.1fr_1.2fr_1fr_auto] items-center gap-3 px-5";

// Lista de contratos, versión simple (como Cobros): buscador, Filtrar, Nuevo contrato y la tabla. initialResidentId: llega desde el perfil
// del residente ("Crear contrato") y abre el panel con ese residente elegido.
export function ContractList({
  rows,
  options,
  initialResidentId,
}: {
  rows: ContractListRow[];
  options: ContractFormOptions;
  initialResidentId?: string;
}) {
  const [filters, setFilters] = useState<ContractFilter[]>([]);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<ContractSheetTarget | null>(
    initialResidentId ? { mode: "create", residentId: initialResidentId } : null,
  );
  const shown = filterContracts(rows, filters, query);

  const create = (
    <Button type="button" className="h-11 gap-2" onClick={() => setSheet({ mode: "create" })}>
      <Plus className="size-4" aria-hidden="true" />
      Nuevo contrato
    </Button>
  );
  const panel = <ContractSheet target={sheet} options={options} onClose={() => setSheet(null)} />;

  if (!rows.length) {
    return (
      <>
        <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no hay contratos</h2>
          <p className="text-muted-foreground">
            Registra quién alquila qué unidad, desde cuándo y por cuánto. Puede ser sin contrato escrito, con
            tu propio papel o desde una plantilla.
          </p>
          {create}
        </section>
        {panel}
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
          options={CONTRACT_FILTERS.map((f) => ({
            id: f.id,
            label: f.label,
            count: rows.filter((r) => matchesContractFilter(r, f.id)).length,
          }))}
          selected={filters}
          onChange={setFilters}
        />
        <span className="hidden flex-1 sm:block" />
        {create}
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        {/* En móvil la tabla se desliza de lado. */}
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <div
              className={cn(
                GRID,
                "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Residente</span>
              <span>Unidad</span>
              <span>Renta</span>
              <span>Termina</span>
              <span>Modalidad</span>
              <span>Estado</span>
              <span className="sr-only">Acciones</span>
            </div>
            {shown.length ? (
              <ul>
                {shown.map((r) => (
                  <li key={r.id} className={cn(GRID, "border-t py-3.5 text-sm")}>
                    <Link
                      href={`/residentes/${r.residentId}`}
                      className="truncate font-semibold hover:underline"
                    >
                      {r.residentName}
                    </Link>
                    <span>{r.unitName}</span>
                    <span>{formatSoles(r.monthlyRent)}</span>
                    <span>{r.endsIn}</span>
                    <span className="text-muted-foreground">{PAPERWORK_LABEL[r.paperwork]}</span>
                    <span>
                      <ContractPhaseBadge phase={r.phase} />
                    </span>
                    <Link
                      href={`/contratos/${r.id}`}
                      className={buttonVariants({ variant: "outline", className: "h-11" })}
                    >
                      Ver
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                Ningún contrato coincide con ese filtro o búsqueda.
              </p>
            )}
          </div>
        </div>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          Mostrando {shown.length} de {rows.length} {rows.length === 1 ? "contrato" : "contratos"}
        </p>
      </section>
      {panel}
    </>
  );
}
