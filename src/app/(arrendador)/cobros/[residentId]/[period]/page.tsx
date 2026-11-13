import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PaymentReviewButtons } from "@/components/payments/payment-review-buttons";
import { ReceiptBadge } from "@/components/payments/receipt-badge";
import { RegisterPaymentButton } from "@/components/payments/register-payment-button";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/server/contracts/dates";
import { toCents } from "@/server/payments/money";
import { getReceipt } from "@/server/payments/queries";
import { CONCEPT_LABEL, periodLabel } from "@/server/payments/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

export const metadata: Metadata = { title: "Recibo · Gestión de residencias" };

const PAYMENT_STATUS = {
  confirmed: { tone: "ok", label: "Confirmado" },
  in_review: { tone: "primary", label: "En revisión" },
  rejected: { tone: "danger", label: "Rechazado" },
} as const;

const card = "rounded-xl border bg-card shadow-card";
const label = "text-xs font-bold tracking-wider text-muted-foreground uppercase";

function Amount({ name, value, className }: { name: string; value: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{name}</span>
      <span className={cn("text-2xl font-extrabold tabular-nums", className)}>{value}</span>
    </div>
  );
}

// Detalle de un recibo (lo que un residente debe en un mes) y sus pagos. Cada pago, completo o una parte, es un
// registro aparte; el recibo suma solo los confirmados.
async function Content({ params }: { params: PageProps<"/cobros/[residentId]/[period]">["params"] }) {
  const { residentId, period } = await params;
  const r = await getReceipt(residentId, period);
  if (!r) notFound();
  const total = toCents(r.total);
  const percent = total > 0 ? Math.min(100, Math.round((toCents(r.paid) / total) * 100)) : 0;
  const owes = toCents(r.balance) > 0;
  // Numerados del más antiguo al más reciente: "pago 1, pago 2…".
  const payments = [...r.payments].reverse();

  return (
    <>
      <nav aria-label="Ruta" className="text-sm text-muted-foreground">
        <Link href={`/cobros?mes=${period}`} className="font-semibold text-link hover:underline">
          ‹ Cobros
        </Link>{" "}
        · <span className="first-letter:uppercase">{periodLabel(period)}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] font-bold tracking-tight">Recibo de {periodLabel(period)}</h1>
            {r.charges.length ? <ReceiptBadge status={r.status} balance={r.balance} paid={r.paid} /> : null}
          </div>
          <p className="text-muted-foreground">
            <Link
              href={`/residentes/${residentId}`}
              className="font-semibold text-foreground hover:underline"
            >
              {r.residentName}
            </Link>
            {r.units.length ? ` · ${r.units.join(", ")}` : ""}
          </p>
        </div>
        {owes ? (
          <RegisterPaymentButton
            businessId={r.businessId}
            residentId={residentId}
            period={period}
            periodText={periodLabel(period)}
            residentName={r.residentName}
            suggestedAmount={String(Number(r.balance))}
            label={r.payments.length ? "Registrar otro pago" : "Registrar pago"}
          />
        ) : null}
      </div>

      <section className={cn(card, "flex flex-col gap-5 p-5 sm:p-6")}>
        {r.charges.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-3">
              <Amount name="Total del recibo" value={formatSoles(r.total)} />
              <Amount name="Pagado (confirmado)" value={formatSoles(r.paid)} className="text-ok" />
              <Amount
                name="Falta"
                value={formatSoles(r.balance)}
                className={owes ? "text-warn" : undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div
                role="progressbar"
                aria-label="Cuánto se pagó del recibo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2.5 overflow-hidden rounded-full bg-primary-soft"
              >
                <div className="h-full rounded-full bg-bar" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {owes
                  ? `${percent}% pagado · faltan ${formatSoles(r.balance)} para completar el recibo`
                  : "Recibo completo."}
                {r.daysLate > 0 ? (
                  <span className="text-danger">
                    {" "}
                    · {r.daysLate} {r.daysLate === 1 ? "día" : "días"} de atraso
                  </span>
                ) : null}
              </p>
              {Number(r.credit) > 0 ? (
                <p className="text-sm text-ok">
                  Pagó {formatSoles(r.credit)} de más: queda como saldo a favor.
                </p>
              ) : null}
            </div>
            <ul className="border-t pt-1">
              {r.charges.map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span>
                    <b>
                      {CONCEPT_LABEL[c.concept]}
                      {c.concept === "rent" && c.unitName ? ` · ${c.unitName}` : ""}
                    </b>
                    <span className="text-muted-foreground">
                      {" "}
                      · vence el {formatLongDate(c.dueDate)}
                      {c.note ? ` · ${c.note}` : ""}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatSoles(c.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Este mes no tiene cargos.</p>
        )}
      </section>

      <section className={cn(card, "overflow-hidden")}>
        <div className="px-5 pt-5 pb-2 sm:px-6">
          <h2 className="text-lg font-bold">Pagos de este recibo</h2>
          <p className="text-sm text-muted-foreground">
            Cada parte se registra por separado. Solo suman los confirmados.
          </p>
        </div>
        {payments.length ? (
          <ol>
            {payments.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 border-t px-5 py-4 sm:px-6">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-bold text-chip-foreground"
                  aria-label={`Pago ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-52 flex-1 text-sm">
                  <b className="block text-base tabular-nums">{formatSoles(p.amount)}</b>
                  <span className="text-muted-foreground">
                    {METHOD_LABEL[p.method]} · {formatLongDate(p.paidOn)}
                    {p.operationCode ? ` · Op. ${p.operationCode}` : ""} ·{" "}
                    {p.fromResident ? "Lo mandó el residente" : "Registrado por ti"}
                    {p.status === "in_review" ? " · todavía no suma" : ""}
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
                    className={buttonVariants({ variant: "outline", className: "h-10" })}
                  >
                    Ver comprobante
                  </a>
                ) : null}
                {p.status === "in_review" ? <PaymentReviewButtons paymentId={p.id} /> : null}
                {p.status === "confirmed" ? <PaymentReviewButtons paymentId={p.id} confirmed /> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-t px-5 py-6 text-sm text-muted-foreground sm:px-6">
            Todavía no hay pagos en este recibo.
          </p>
        )}
      </section>
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
