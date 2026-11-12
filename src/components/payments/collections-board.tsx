"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysBetween, formatLongDate } from "@/server/contracts/dates";
import type { CollectionsView } from "@/server/payments/queries";
import { periodLabel, type ReceiptStatus } from "@/server/payments/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

import { PaymentForm } from "./payment-form";
import { PaymentReviewButtons } from "./payment-review-buttons";
import { ReceiptBadge } from "./receipt-badge";

type Filter = "all" | "paid" | "pending" | "overdue";

const FILTERS: { id: Filter; label: string; statuses: ReceiptStatus[] | null }[] = [
  { id: "all", label: "Todos", statuses: null },
  { id: "paid", label: "Pagados", statuses: ["paid"] },
  { id: "pending", label: "Pendientes", statuses: ["pending", "partial"] },
  { id: "overdue", label: "Vencidos", statuses: ["overdue"] },
];

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const GRID = "grid grid-cols-[1.3fr_1.2fr_.9fr_1fr_1.3fr_auto] items-center gap-3 px-5";
const card = "rounded-xl border bg-card shadow-card";

// "Hace 8 días", "Hoy", "En 3 días", "Día 5" para la columna Vence.
function dueText(due: string | null, today: string) {
  if (!due) return "—";
  const days = daysBetween(today, due);
  if (days === 0) return "Hoy";
  if (days < 0) return days === -1 ? "Ayer" : `Hace ${-days} días`;
  if (days <= 7) return days === 1 ? "Mañana" : `En ${days} días`;
  return `Día ${Number(due.slice(8))}`;
}

// Cobros y morosidad: recibos del mes con filtros, comprobantes por revisar, morosos y registrar un pago.
export function CollectionsBoard({ view, today }: { view: CollectionsView; today: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const matches = (status: ReceiptStatus, f: Filter) => {
    const statuses = FILTERS.find((x) => x.id === f)!.statuses;
    return statuses === null || statuses.includes(status);
  };
  const q = fold(query.trim());
  const shown = view.receipts.filter(
    (r) =>
      matches(r.status, filter) && (q === "" || fold(`${r.residentName} ${r.units.join(" ")}`).includes(q)),
  );
  const payable = view.receipts
    .filter((r) => r.status !== "paid")
    .map((r) => ({
      id: r.residentId,
      label: `${r.residentName}${r.units.length ? ` · ${r.units.join(", ")}` : ""}`,
      balance: String(Number(r.balance)),
    }));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        {view.toReview.length ? (
          <section className={cn(card, "p-5 sm:p-6")}>
            <h2 className="mb-1 text-lg font-bold">Comprobantes por revisar</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Los mandaron tus residentes. Compáralos con lo que llegó a tu cuenta antes de confirmarlos.
            </p>
            <ul>
              {view.toReview.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 border-t py-3.5 first:border-t-0">
                  <span className="min-w-52 flex-1">
                    <b className="block">
                      {p.residentName} · {formatSoles(p.amount)}
                    </b>
                    <span className="text-sm text-muted-foreground">
                      {METHOD_LABEL[p.method]} · {formatLongDate(p.paidOn)} · Recibo de{" "}
                      {periodLabel(p.period)}
                      {p.operationCode ? ` · Op. ${p.operationCode}` : ""}
                    </span>
                    {p.mismatch ? (
                      <span className="mt-1 block text-sm text-warn">
                        No coincide con lo que falta del recibo ({formatSoles(p.balance)}).
                      </span>
                    ) : null}
                  </span>
                  {p.hasProof ? (
                    <a
                      href={`/archivos/comprobante/${p.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", className: "h-11" })}
                    >
                      Ver comprobante
                    </a>
                  ) : null}
                  <PaymentReviewButtons paymentId={p.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={cn(card, "overflow-hidden")}>
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
                {f.label} {view.receipts.filter((r) => matches(r.status, f.id)).length}
              </button>
            ))}
            <span className="hidden flex-1 sm:block" />
            <div className="relative w-full sm:max-w-64">
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
          {view.receipts.length ? (
            // En móvil la tabla se desliza de lado.
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
                  <span>Monto</span>
                  <span>Vence</span>
                  <span>Estado</span>
                  <span className="sr-only">Acciones</span>
                </div>
                {shown.length ? (
                  <ul>
                    {shown.map((r) => (
                      <li key={r.residentId} className={cn(GRID, "border-t py-3.5 text-sm")}>
                        <span className="truncate font-semibold">
                          {r.residentName}
                          {r.inReview ? (
                            <span className="ml-2 align-middle">
                              <StatusBadge tone="primary">Comprobante en revisión</StatusBadge>
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate">{r.units.join(", ") || "—"}</span>
                        <span>{formatSoles(r.total)}</span>
                        <span>{r.status === "paid" ? "—" : dueText(r.nextDue, today)}</span>
                        <span>
                          <ReceiptBadge status={r.status} balance={r.balance} paid={r.paid} />
                        </span>
                        <Link
                          href={`/cobros/${r.residentId}/${r.period}`}
                          className={buttonVariants({
                            variant: r.status === "paid" ? "outline" : "default",
                            className: "h-11",
                          })}
                        >
                          {r.status === "paid" ? "Ver" : "Registrar pago"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t px-5 py-8 text-center text-muted-foreground">
                    Ningún recibo coincide con ese filtro o búsqueda.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t px-5 py-8 text-center text-muted-foreground">
              <p className="font-semibold text-foreground">No hay recibos en {periodLabel(view.period)}.</p>
              <p className="mt-1 text-sm">
                Los recibos se crean solos al confirmar un contrato, uno por cada mes que dura.
              </p>
            </div>
          )}
        </section>

        <section className={cn(card, "p-5 sm:p-6")}>
          <h2 className="mb-3 text-lg font-bold">Morosidad</h2>
          {view.delinquent.length ? (
            <ul>
              {view.delinquent.map((d) => (
                <li
                  key={d.residentId}
                  className="flex flex-wrap items-center gap-3 border-t py-3.5 first:border-t-0"
                >
                  <span className="min-w-52 flex-1">
                    <b className="block">{d.residentName}</b>
                    <span className="text-sm text-muted-foreground">
                      Debe {formatSoles(d.owed)} · {d.daysLate} {d.daysLate === 1 ? "día" : "días"} de atraso
                      · {d.periods.map(periodLabel).join(", ")}
                    </span>
                  </span>
                  <StatusBadge tone="danger">Vencido</StatusBadge>
                  <Link
                    href={`/cobros/${d.residentId}/${d.periods[0]}`}
                    className={buttonVariants({ variant: "outline", className: "h-11" })}
                  >
                    Ver recibo
                  </Link>
                  <Link
                    href={`/residentes/${d.residentId}`}
                    className={buttonVariants({ variant: "outline", className: "h-11" })}
                  >
                    Ver perfil
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nadie está atrasado. Todo al día.</p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            No se cobra mora: solo se marca como vencido y se cuentan los días. Los recordatorios automáticos
            llegan más adelante.
          </p>
        </section>
      </div>

      <aside className={cn(card, "p-5 sm:p-6 lg:sticky lg:top-24")}>
        <h2 className="mb-1 text-lg font-bold">Registrar un pago</h2>
        <p className="mb-4 text-sm text-muted-foreground">Recibo de {periodLabel(view.period)}.</p>
        {payable.length ? (
          <PaymentForm
            key={view.period}
            mode="landlord"
            businessId={view.businessId}
            period={view.period}
            residents={payable}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {view.receipts.length
              ? "Todos los recibos de este mes están pagados."
              : "No hay recibos este mes."}
          </p>
        )}
      </aside>
    </div>
  );
}
