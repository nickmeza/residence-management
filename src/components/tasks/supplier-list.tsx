"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SupplierRow } from "@/server/tasks/queries";

import { SupplierDialog } from "./supplier-dialog";

// Directorio de proveedores (MT-06): buscador, "Nuevo proveedor" y la lista con cuántos trabajos tiene cada uno.
export function SupplierList({ businessId, rows }: { businessId: string; rows: SupplierRow[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) => !q || [r.name, r.trade, r.phone].some((v) => v?.toLowerCase().includes(q)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        {rows.length ? (
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Buscar"
              type="search"
              placeholder="Buscar por nombre u oficio"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        ) : null}
        <span className="hidden flex-1 sm:block" />
        <Button type="button" className="h-11 gap-2" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo proveedor
        </Button>
      </div>
      {rows.length ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-card">
          {shown.length ? (
            <ul>
              {shown.map((s, i) => (
                <li key={s.id} className={i ? "border-t" : undefined}>
                  <Link
                    href={`/mantenimiento/proveedores/${s.id}`}
                    className="flex min-h-16 items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-muted"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b>{s.name}</b>
                      <span className="text-sm text-muted-foreground">
                        {[s.trade, s.phone].filter(Boolean).join(" · ") || "Sin oficio ni celular"}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {s.jobs === 1 ? "1 trabajo" : `${s.jobs} trabajos`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-muted-foreground">Nadie con ese nombre.</p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no hay proveedores</h2>
          <p className="mt-1 text-muted-foreground">
            Guarda aquí a tu gasfitero, electricista o a quien limpia. Luego los eliges en los pedidos y en
            las tareas, y ves cuánto le pagaste a cada uno.
          </p>
        </section>
      )}
      <SupplierDialog open={open} onOpenChange={setOpen} businessId={businessId} />
    </>
  );
}
