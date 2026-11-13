"use client";

import { Bell, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilterMenu } from "@/components/filter-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysBetween } from "@/server/contracts/dates";
import {
  filterReceipts,
  hasPayable,
  matchesFilter,
  RECEIPT_FILTERS,
  reviewSummary,
  type ReceiptFilter,
} from "@/server/payments/collections-filter";
import type { CollectionsView } from "@/server/payments/queries";
import { periodLabel } from "@/server/payments/rules";

import { PaymentForm } from "./payment-form";
import { ReceiptBadge } from "./receipt-badge";

// "Hace 8 días", "Hoy", "En 3 días", "Día 5" para la columna Vence.
function dueText(due: string | null, today: string) {
  if (!due) return "—";
  const days = daysBetween(today, due);
  if (days === 0) return "Hoy";
  if (days < 0) return days === -1 ? "Ayer" : `Hace ${-days} días`;
  if (days <= 7) return days === 1 ? "Mañana" : `En ${days} días`;
  return `Día ${Number(due.slice(8))}`;
}

const month = (period: string) => periodLabel(period).replace(/ de \d{4}$/, "");

// Cobros: los recibos del mes en una tabla, con aviso de comprobantes, búsqueda, filtros y registrar un pago.
export function CollectionsTable({ view, today }: { view: CollectionsView; today: string }) {
  const [filters, setFilters] = useState<ReceiptFilter[]>([]);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const shown = filterReceipts(view.receipts, filters, query);
  const review = reviewSummary(view.toReview, view.period);
  const payable = view.receipts
    .filter((r) => r.status !== "paid")
    .map((r) => ({
      id: r.residentId,
      label: `${r.residentName}${r.units.length ? ` · ${r.units.join(", ")}` : ""}`,
      balance: String(Number(r.balance)),
    }));
  const canRegister = hasPayable(view.receipts);

  return (
    <>
      {review.total > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-primary-soft px-4 py-2.5 text-sm text-primary-text"
        >
          <Bell className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            Tienes{" "}
            <b>
              {review.total} {review.total === 1 ? "comprobante" : "comprobantes"} por revisar
            </b>
            . No suman al recibo hasta que los confirmes.
          </span>
          {review.others.map((o) => (
            <Link
              key={o.period}
              href={`/cobros?mes=${o.period}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {o.count === 1 ? "1 es" : `${o.count} son`} de {month(o.period)} →
            </Link>
          ))}
          {review.thisMonth > 0 && !filters.includes("review") ? (
            <Button
              type="button"
              size="sm"
              className="h-9 px-3"
              onClick={() => {
                setFilters(["review"]);
                setQuery("");
              }}
            >
              Ver cuáles →
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
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
        <FilterMenu
          options={RECEIPT_FILTERS.map((f) => ({
            ...f,
            count: view.receipts.filter((r) => matchesFilter(r, f.id)).length,
          }))}
          selected={filters}
          onChange={setFilters}
        />
        <span className="hidden flex-1 sm:block" />
        <Button
          type="button"
          variant={canRegister ? "default" : "secondary"}
          className="h-11 w-full gap-2 px-4 sm:w-auto"
          onClick={() => (canRegister ? setFormOpen(true) : setAlertOpen(true))}
        >
          <Plus className="size-4" aria-hidden="true" />
          Registrar pago
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        {view.receipts.length ? (
          // En móvil la tabla se desliza de lado.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-background text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-5 py-3">
                    Residente
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Unidad
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Monto
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Pagado
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Vence
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const earlier = view.earlierDebts.filter((d) => d.residentId === r.residentId);
                  const action = r.status === "paid" ? "Ver" : r.inReview ? "Revisar" : "Registrar pago";
                  return (
                    <tr key={r.residentId} className="border-t">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold">{r.residentName}</span>
                        {r.inReview ? (
                          <span className="block text-xs font-semibold text-primary-text">
                            + {r.inReview === 1 ? "1 comprobante" : `${r.inReview} comprobantes`} en revisión
                          </span>
                        ) : null}
                        {earlier.map((d) => (
                          <Link
                            key={d.period}
                            href={`/cobros/${r.residentId}/${d.period}`}
                            className="block text-xs font-semibold text-danger underline-offset-4 hover:underline"
                          >
                            + debe {month(d.period)} ({formatSoles(d.balance)})
                          </Link>
                        ))}
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">{r.units.join(", ") || "—"}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{formatSoles(r.total)}</td>
                      <td className="px-3 py-3.5 text-right text-muted-foreground tabular-nums">
                        {Number(r.paid) > 0 ? formatSoles(r.paid) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3.5",
                          r.status === "overdue" ? "font-bold text-danger" : "text-muted-foreground",
                        )}
                      >
                        {r.status === "paid" ? "—" : dueText(r.nextDue, today)}
                      </td>
                      <td className="px-3 py-3.5">
                        <ReceiptBadge status={r.status} balance={r.balance} paid={r.paid} />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Link
                          href={`/cobros/${r.residentId}/${r.period}`}
                          className={buttonVariants({
                            variant: action === "Ver" ? "outline" : "default",
                            className: "h-10 px-3.5",
                          })}
                        >
                          {action}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 ? (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                Ningún recibo coincide con la búsqueda o el filtro.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-muted-foreground">
            <p className="font-semibold text-foreground">No hay recibos en {periodLabel(view.period)}.</p>
            <p className="mt-1 text-sm">
              Los recibos se crean solos al confirmar un contrato, uno por cada mes que dura.
            </p>
          </div>
        )}
        {view.receipts.length ? (
          <p className="border-t px-5 py-3 text-sm text-muted-foreground">
            Mostrando {shown.length} de {view.receipts.length}{" "}
            {view.receipts.length === 1 ? "recibo" : "recibos"} · Cobrado {formatSoles(view.stats.collected)}{" "}
            de {formatSoles(view.stats.total)}
          </p>
        ) : null}
      </section>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Registrar pago</SheetTitle>
            <SheetDescription>
              Recibo de {periodLabel(view.period)}. Solo aparecen los residentes que deben algo. Puede ser una
              parte: el recibo queda en “Pago parcial” hasta completarlo.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <PaymentForm
              key={view.period}
              mode="landlord"
              businessId={view.businessId}
              period={view.period}
              residents={payable}
              onDone={() => setFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {view.receipts.length
                ? `Todos los cobros de ${periodLabel(view.period)} ya están pagados`
                : `No hay recibos en ${periodLabel(view.period)}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              No hay ningún recibo con saldo en este mes, así que no hay pagos por registrar. Si quieres
              registrar uno de otro mes, cámbialo arriba a la derecha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertOpen(false)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
