"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatShortDate, formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DinerRow, PensionPaymentRow } from "@/server/pension/queries";
import { BILLING_CYCLE_LABEL } from "@/server/pension/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

import { PaymentDialog } from "./payment-dialog";
import { ProofReviewList } from "./proof-review";
import { QuickPaidButton } from "./quick-paid-button";

const GRID = "grid grid-cols-[1.5fr_1fr_.9fr_.9fr_1.3fr_auto] items-center gap-3 px-5";

// Pensión › Pagos: por adelantado (decisión del dueño). Por cada comensal: hasta qué día pagó, si debe o tiene
// saldo a favor, y el próximo pago sugerido para registrarlo con un toque. Primero los que deben.
export function PaymentsBoard({
  today,
  diners,
  pending,
  payments,
}: {
  today: string;
  diners: DinerRow[];
  // Comprobantes de comensales por revisar (solo si la pensión los recibe).
  pending: PensionPaymentRow[];
  payments: PensionPaymentRow[];
}) {
  const rows = diners
    .filter((d) => d.subscription && d.subscription.state !== "ended")
    .sort((a, b) => Number(a.subscription!.account.balance) - Number(b.subscription!.account.balance));

  return (
    <>
      <ProofReviewList pending={pending} />
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div
              className={cn(
                GRID,
                "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Comensal</span>
              <span>Paga</span>
              <span>Pagado hasta</span>
              <span>Saldo</span>
              <span>Próximo pago</span>
              <span className="sr-only">Acciones</span>
            </div>
            {rows.length ? (
              <ul>
                {rows.map((d) => {
                  const s = d.subscription!;
                  const balance = Number(s.account.balance);
                  return (
                    <li key={d.residentId} className={cn(GRID, "border-t py-3.5 text-sm")}>
                      <span className="min-w-0">
                        <Link
                          href={`/pension/comensales/${d.residentId}`}
                          className="block truncate font-semibold underline-offset-4 hover:underline"
                        >
                          {d.name}
                        </Link>
                        <span className="block truncate text-muted-foreground">{s.planName}</span>
                      </span>
                      <span>{BILLING_CYCLE_LABEL[s.billingCycle]}</span>
                      <span>
                        {s.account.paidUntil ? (
                          formatShortDate(s.account.paidUntil)
                        ) : (
                          <span className="text-muted-foreground">Sin pagos</span>
                        )}
                      </span>
                      <span>
                        {s.account.partial ? (
                          <StatusBadge tone="warn">Pago parcial · faltan {formatSoles(s.account.partial.missing)}</StatusBadge>
                        ) : balance < 0 ? (
                          <StatusBadge tone="danger">Debe {formatSoles(-balance)}</StatusBadge>
                        ) : balance > 0 ? (
                          <StatusBadge tone="ok">A favor {formatSoles(balance)}</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Al día</StatusBadge>
                        )}
                      </span>
                      <span>
                        <b>{formatSoles(s.account.next.amount)}</b>
                        <span className="block text-muted-foreground">
                          {formatShortDate(s.account.next.from)} – {formatShortDate(s.account.next.to)}
                        </span>
                      </span>
                      <span className="flex flex-wrap justify-end gap-2">
                        <QuickPaidButton
                          subscriptionId={s.id}
                          name={d.name}
                          today={today}
                          suggestion={s.account.next}
                        />
                        <PaymentDialog
                          subscriptionId={s.id}
                          name={d.name}
                          today={today}
                          suggestion={s.account.next}
                          trigger={(open) => (
                            <Button type="button" variant="outline" className="h-11" onClick={open}>
                              Registrar pago
                            </Button>
                          )}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                Todavía no tienes comensales con plan. Agrégalos en Clientes.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-lg font-bold">Últimos pagos</h2>
        {payments.length ? (
          <ul className="mt-2 divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <b>{p.name}</b> · {formatSoles(p.amount)} · {METHOD_LABEL[p.method]}
                  {p.operationCode ? ` · Op. ${p.operationCode}` : ""}
                  <span className="block text-muted-foreground">
                    Pagó el {formatShortDate(p.paidOn)} · cubre del {formatShortDate(p.coversFrom)} al{" "}
                    {formatShortDate(p.coversTo)}
                    {p.note ? ` · ${p.note}` : ""}
                    {p.status === "rejected" && p.rejectionReason ? ` · Motivo: ${p.rejectionReason}` : ""}
                  </span>
                </span>
                {p.hasProof ? (
                  <a
                    href={`/archivos/comprobante-pension/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold text-link underline-offset-4 hover:underline"
                  >
                    Comprobante
                  </a>
                ) : null}
                {p.status === "rejected" ? (
                  <StatusBadge tone="danger">Rechazado</StatusBadge>
                ) : (
                  <StatusBadge tone="ok">Confirmado</StatusBadge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no registraste pagos.</p>
        )}
      </section>
    </>
  );
}
