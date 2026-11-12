import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentReviewButtons } from "@/components/payments/payment-review-buttons";
import { ReceiptBadge } from "@/components/payments/receipt-badge";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import { getReceipt } from "@/server/payments/queries";
import { CONCEPT_LABEL, periodLabel } from "@/server/payments/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

export const metadata: Metadata = { title: "Recibo · Gestión de residencias" };

const PAYMENT_STATUS = {
  confirmed: { tone: "ok", label: "Confirmado" },
  in_review: { tone: "primary", label: "En revisión" },
  rejected: { tone: "danger", label: "Rechazado" },
} as const;

async function Content({ params }: { params: PageProps<"/cobros/[residentId]/[period]">["params"] }) {
  const { residentId, period } = await params;
  const r = await getReceipt(residentId, period);
  if (!r) notFound();
  const index = r.periods.indexOf(period);
  const prev = index > 0 ? r.periods[index - 1] : null;
  const next = index >= 0 && index < r.periods.length - 1 ? r.periods[index + 1] : null;
  const outline = buttonVariants({ variant: "outline", className: "h-11" });

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {r.tradeName} ›{" "}
          <Link href={`/cobros?mes=${period}`} className="hover:underline">
            Cobros
          </Link>{" "}
          › <b className="text-foreground">{r.residentName}</b>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[34px] font-bold tracking-tight">Recibo de {periodLabel(period)}</h1>
          {r.charges.length ? <ReceiptBadge status={r.status} balance={r.balance} paid={r.paid} /> : null}
        </div>
        <p className="text-muted-foreground">
          <Link href={`/residentes/${residentId}`} className="font-semibold text-foreground hover:underline">
            {r.residentName}
          </Link>
          {r.units.length ? ` · ${r.units.join(", ")}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {prev ? (
            <Link href={`/cobros/${residentId}/${prev}`} className={outline}>
              ← {periodLabel(prev)}
            </Link>
          ) : null}
          {next ? (
            <Link href={`/cobros/${residentId}/${next}`} className={outline}>
              {periodLabel(next)} →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
            <h2 className="mb-3 text-lg font-bold">Detalle</h2>
            {r.charges.length ? (
              <>
                <ul>
                  {r.charges.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap justify-between gap-2 border-t py-3 text-sm first:border-t-0"
                    >
                      <span>
                        <b className="block">
                          {CONCEPT_LABEL[c.concept]}
                          {c.concept === "rent" ? ` · ${c.unitName}` : ""}
                        </b>
                        <span className="text-muted-foreground">
                          Vence el {formatLongDate(c.dueDate)}
                          {c.note ? ` · ${c.note}` : ""}
                        </span>
                      </span>
                      <b>{formatSoles(c.amount)}</b>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-col gap-1 rounded-lg bg-primary-soft p-4 text-primary-text">
                  <div className="flex justify-between gap-2">
                    <span>Total</span>
                    <b>{formatSoles(r.total)}</b>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Pagado</span>
                    <b>{formatSoles(r.paid)}</b>
                  </div>
                  <div className="flex justify-between gap-2 text-lg">
                    <b>Falta</b>
                    <b>{formatSoles(r.balance)}</b>
                  </div>
                  {Number(r.credit) > 0 ? (
                    <p className="text-sm">Pagó {formatSoles(r.credit)} de más: queda como saldo a favor.</p>
                  ) : null}
                </div>
                {r.daysLate > 0 ? (
                  <p className="mt-3 text-sm text-danger">
                    {r.daysLate} {r.daysLate === 1 ? "día" : "días"} de atraso.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Este mes no tiene cargos.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
            <h2 className="mb-3 text-lg font-bold">Pagos</h2>
            {r.payments.length ? (
              <ul>
                {r.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 border-t py-3.5 first:border-t-0"
                  >
                    <span className="min-w-52 flex-1 text-sm">
                      <b className="block text-base">{formatSoles(p.amount)}</b>
                      <span className="text-muted-foreground">
                        {METHOD_LABEL[p.method]} · {formatLongDate(p.paidOn)}
                        {p.operationCode ? ` · Op. ${p.operationCode}` : ""} ·{" "}
                        {p.fromResident ? "Lo mandó el residente" : "Registrado por ti"}
                      </span>
                      {p.rejectionReason ? (
                        <span className="block text-danger">Motivo: {p.rejectionReason}</span>
                      ) : null}
                    </span>
                    <StatusBadge tone={PAYMENT_STATUS[p.status].tone}>
                      {PAYMENT_STATUS[p.status].label}
                    </StatusBadge>
                    {p.hasProof ? (
                      <a
                        href={`/archivos/comprobante/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={outline}
                      >
                        Ver comprobante
                      </a>
                    ) : null}
                    {p.status === "in_review" ? <PaymentReviewButtons paymentId={p.id} /> : null}
                    {p.status === "confirmed" ? <PaymentReviewButtons paymentId={p.id} confirmed /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay pagos en este recibo.</p>
            )}
          </section>
        </div>

        <aside className="rounded-xl border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
          <h2 className="mb-1 text-lg font-bold">Registrar un pago</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Puede ser una parte: el recibo queda en “Pago parcial” hasta completarlo.
          </p>
          <PaymentForm
            mode="landlord"
            businessId={r.businessId}
            period={period}
            residentId={residentId}
            suggestedAmount={Number(r.balance) > 0 ? String(Number(r.balance)) : ""}
          />
        </aside>
      </div>
    </>
  );
}

export default function ReceiptPage({ params }: PageProps<"/cobros/[residentId]/[period]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
