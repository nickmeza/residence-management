import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DetailSkeleton } from "@/components/skeletons";
import { SupplierActions } from "@/components/tasks/supplier-actions";
import { formatShortDate, formatSoles } from "@/lib/format";
import { getSupplier } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Proveedor · Gestión de residencias" };

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSupplier(id);
  if (!s) notFound();
  const phone = s.phone?.replace(/[^\d+]/g, "");
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/mantenimiento/proveedores" className="hover:underline">
            Proveedores
          </Link>{" "}
          › <b className="text-foreground">{s.name}</b>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-bold tracking-tight">{s.name}</h1>
            <p className="text-muted-foreground">
              {s.trade ?? "Sin oficio"}
              {phone ? (
                <>
                  {" · "}
                  <a
                    href={`tel:${phone}`}
                    className="font-semibold text-link underline-offset-4 hover:underline"
                  >
                    {s.phone}
                  </a>
                </>
              ) : null}
            </p>
          </div>
          <SupplierActions supplier={s} />
        </div>
        {s.note ? <p className="text-sm whitespace-pre-line">{s.note}</p> : null}
      </div>
      <section className={card} aria-labelledby="historial">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="historial" className="text-lg font-bold">
            Trabajos
          </h2>
          <span className="text-sm text-muted-foreground">
            Total pagado: <b className="text-foreground">{formatSoles(s.totalCost) ?? "S/ 0"}</b>
          </span>
        </div>
        {s.history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Trabajo</th>
                  <th className="py-2 pr-3">De</th>
                  <th className="py-2 text-right">Costo</th>
                </tr>
              </thead>
              <tbody>
                {s.history.map((h) => (
                  <tr key={h.key} className="border-t">
                    <td className="py-2.5 pr-3">{formatShortDate(h.date)}</td>
                    <td className="py-2.5 pr-3 font-semibold">
                      {h.href ? (
                        <Link href={h.href} className="hover:underline">
                          {h.title}
                        </Link>
                      ) : (
                        h.title
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {h.source === "request" ? "Pedido" : "Tarea que se repite"}
                    </td>
                    <td className="py-2.5 text-right">{h.cost ? formatSoles(h.cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Todavía no tiene trabajos. Elígelo en un pedido de mantenimiento o al marcar una tarea como hecha.
          </p>
        )}
      </section>
    </>
  );
}

// Ficha de un proveedor (MT-06) con su historial de trabajos y lo que se le pagó.
export default function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
