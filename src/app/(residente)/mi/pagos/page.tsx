import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentForm } from "@/components/payments/payment-form";
import { ReceiptBadge } from "@/components/payments/receipt-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatSoles } from "@/lib/format";
import { formatLongDate, limaToday } from "@/server/contracts/dates";
import { CONCEPT_LABEL, periodLabel, periodOf } from "@/server/payments/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";
import { getMyBilling, type MyBilling } from "@/server/payments/self";

export const metadata: Metadata = { title: "Mis pagos · Mi residencia" };

const card = "flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card";

const PAYMENT_STATUS = {
  confirmed: { tone: "ok", label: "Confirmado" },
  in_review: { tone: "primary", label: "En revisión" },
  rejected: { tone: "danger", label: "Rechazado" },
} as const;

function Business({ b, thisPeriod }: { b: MyBilling; thisPeriod: string }) {
  const r = b.current;
  const history = b.receipts.filter((x) => x.period <= thisPeriod && x !== r);
  const upcoming = b.receipts.filter((x) => x.period > thisPeriod && x !== r).reverse();
  const methods = b.methods.filter((m) => m !== "card");

  return (
    <>
      {r ? (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Recibo de {periodLabel(r.period)}</h2>
            <ReceiptBadge status={r.status} balance={r.balance} paid={r.paid} />
          </div>
          <ul>
            {r.charges.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 border-t py-2.5 text-sm first:border-t-0">
                <span className="text-muted-foreground">
                  {CONCEPT_LABEL[c.concept]}
                  {c.concept === "rent" && c.unitName ? ` · ${c.unitName}` : ""}
                  {c.note ? ` (${c.note})` : ""}
                  <span className="block text-xs">Vence el {formatLongDate(c.dueDate)}</span>
                </span>
                <b>{formatSoles(c.amount)}</b>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-lg bg-primary-soft p-4 text-primary-text">
            <b>{r.status === "paid" ? "Pagado" : "Te falta pagar"}</b>
            <b className="text-3xl">{formatSoles(r.status === "paid" ? r.paid : r.balance)}</b>
          </div>
          {r.daysLate > 0 ? (
            <p className="text-sm text-danger">
              Venció hace {r.daysLate} {r.daysLate === 1 ? "día" : "días"}.
            </p>
          ) : null}
          {r.payments.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {r.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">
                    {formatSoles(p.amount)} · {METHOD_LABEL[p.method]} · {formatLongDate(p.paidOn)}
                    {p.rejectionReason ? (
                      <span className="block text-danger">Motivo: {p.rejectionReason}</span>
                    ) : null}
                  </span>
                  <StatusBadge tone={PAYMENT_STATUS[p.status].tone}>
                    {PAYMENT_STATUS[p.status].label}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section className={card}>
          <p className="text-muted-foreground">
            No tienes recibos por ahora. Se crean cuando tu residencia confirma tu contrato.
          </p>
        </section>
      )}

      {r && r.status !== "paid" ? (
        <section className={card}>
          <h2 className="text-lg font-bold">Cómo pagar</h2>
          <p className="text-sm text-muted-foreground">
            {methods.length
              ? `${b.businessName} acepta ${methods.map((m) => METHOD_LABEL[m]).join(", ")}.`
              : `Pregúntale a ${b.businessName} cómo pagar.`}
            {b.phone ? ` Teléfono: ${b.phone}.` : ""}
            {b.ruc ? ` RUC ${b.ruc}.` : ""} Paga y sube tu comprobante: tu residencia lo revisa y lo confirma.
          </p>
          <PaymentForm
            mode="resident"
            businessId={b.businessId}
            period={r.period}
            residentId={b.residentId}
            suggestedAmount={String(Number(r.balance))}
            methods={methods.length ? methods : undefined}
          />
        </section>
      ) : null}

      {upcoming.length ? (
        <section className={card}>
          <h2 className="text-lg font-bold">Próximos recibos</h2>
          <ul>
            {upcoming.slice(0, 6).map((x) => (
              <li
                key={x.period}
                className="flex justify-between gap-2 border-t py-2.5 text-sm first:border-t-0"
              >
                <span className="first-letter:uppercase">{periodLabel(x.period)}</span>
                <b>{formatSoles(x.total)}</b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history.length ? (
        <section className={card}>
          <h2 className="text-lg font-bold">Historial</h2>
          <ul>
            {history.map((x) => (
              <li
                key={x.period}
                className="flex flex-wrap items-center justify-between gap-2 border-t py-2.5 text-sm first:border-t-0"
              >
                <span className="flex-1 first-letter:uppercase">{periodLabel(x.period)}</span>
                <span>{formatSoles(x.total)}</span>
                <ReceiptBadge status={x.status} balance={x.balance} paid={x.paid} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

async function Content() {
  const billing = await getMyBilling();
  const thisPeriod = periodOf(limaToday(new Date()));
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Mis pagos</h1>
        <p className="text-muted-foreground">Lo que debes, cómo pagar y tu historial.</p>
      </div>
      {billing.length ? (
        billing.map((b) => (
          // Recibo único: un bloque por negocio, cada uno cobra por separado.
          <div key={b.residentId} className="flex flex-col gap-4">
            {billing.length > 1 ? <h2 className="text-lg font-bold">{b.businessName}</h2> : null}
            <Business b={b} thisPeriod={thisPeriod} />
          </div>
        ))
      ) : (
        <p className="text-muted-foreground">Tu cuenta todavía no está en ninguna residencia.</p>
      )}
    </>
  );
}

export default function MyPaymentsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
