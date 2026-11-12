import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { DepositBadge } from "@/components/deposits/deposit-badge";
import {
  DisputeButton,
  EntryReportForm,
  SettlementResponse,
} from "@/components/resident-side/deposit-actions";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import { AREA_LABEL, DEPOSIT_RULE_LABEL } from "@/server/deposits/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";
import { getMyDeposits, type MyDeposit } from "@/server/payments/self";

export const metadata: Metadata = { title: "Mi garantía · Mi residencia" };

const card = "flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card";

const STEPS = [
  ["La dejas al empezar", "Se paga una sola vez, con tu primer recibo."],
  ["Cuidas tu espacio", "Si al entrar ves algo mal, repórtalo con una foto: no se te descontará."],
  ["Se revisa al salir", "Se compara con lo que reportaste al entrar."],
  ["Se te devuelve el saldo", "La garantía menos los daños que se encuentren, si los hay."],
] as const;

const DISCOUNT_STATUS = {
  active: { tone: "neutral", label: "Vigente" },
  disputed: { tone: "danger", label: "En disputa" },
  adjusted: { tone: "primary", label: "Ajustado" },
  withdrawn: { tone: "ok", label: "Retirado" },
} as const;

function Settlement({ d }: { d: MyDeposit }) {
  const s = d.settlement!;
  const sum = s.summary;
  const methods = d.refundMethods.filter((m) => m !== "card");
  return (
    <>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Tu liquidación</h2>
          <StatusBadge tone={s.status === "closed" ? "ok" : s.acceptedAt ? "primary" : "warn"}>
            {s.status === "closed" ? "Cerrada" : s.acceptedAt ? "Aceptada" : "Esperando tu respuesta"}
          </StatusBadge>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span>Garantía</span>
            <b>{formatSoles(d.amount)}</b>
          </div>
          <div className="flex justify-between">
            <span>Descuentos por daños</span>
            <b>− {formatSoles(sum.totalDiscounts)}</b>
          </div>
          {sum.hasDisputes ? (
            <div className="flex justify-between">
              <span>En disputa (aparte)</span>
              <b>{formatSoles(sum.disputed)}</b>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary-soft p-4 text-primary-text">
          <b>Se te devuelve</b>
          <b className="text-3xl">{formatSoles(sum.refund)}</b>
        </div>
        {Number(sum.excess) > 0 ? (
          <p className="text-sm text-warn">
            Los daños pasan tu garantía por {formatSoles(sum.excess)}.
            {s.excessCharged
              ? " Se agregó a tu recibo de este mes."
              : s.excessWaived
                ? " Tu residencia decidió no cobrártelo."
                : ""}
          </p>
        ) : null}
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Detalle de los descuentos</h2>
        {s.discounts.length ? (
          <ul>
            {s.discounts.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 border-t py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-40 flex-1">
                    <b className="block">{AREA_LABEL[x.area]}</b>
                    <span className="text-sm text-muted-foreground">{x.note}</span>
                  </span>
                  <b>− {formatSoles(x.amount)}</b>
                  <StatusBadge tone={DISCOUNT_STATUS[x.status].tone}>
                    {DISCOUNT_STATUS[x.status].label}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {x.hasPhoto ? (
                    <a
                      href={`/archivos/descuento/${x.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", className: "h-11" })}
                    >
                      Ver foto
                    </a>
                  ) : null}
                  {x.status === "active" && s.status === "sent" ? (
                    <DisputeButton discountId={x.id} label={AREA_LABEL[x.area]} />
                  ) : null}
                </div>
                {x.disputeReason ? (
                  <p className="text-sm text-muted-foreground">Tu motivo: “{x.disputeReason}”</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin descuentos: se te devuelve toda la garantía.</p>
        )}
      </section>

      {s.status === "sent" ? (
        <section className={card}>
          <h2 className="text-lg font-bold">¿Dónde recibes tu devolución?</h2>
          <SettlementResponse
            settlementId={s.id}
            methods={methods.length ? methods : ["yape", "plin", "transfer"]}
            initial={{ method: s.refundMethod, account: s.refundAccount }}
            accepted={s.acceptedAt !== null}
            canAccept={!sum.hasDisputes}
          />
          <p className="text-sm text-muted-foreground">
            Si no estás de acuerdo con un descuento, dispútalo. Lo que nadie discute se te puede devolver ya.
            Plazo: {d.refundDays} días hábiles.
          </p>
        </section>
      ) : null}

      {s.refunds.length ? (
        <section className={card}>
          <h2 className="text-lg font-bold">Devoluciones recibidas</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {s.refunds.map((r) => (
              <li key={r.id}>
                <b>{formatSoles(r.amount)}</b> · {METHOD_LABEL[r.method]} · {formatLongDate(r.paidOn)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Deposit({ d }: { d: MyDeposit }) {
  if (d.phase === "none") {
    return (
      <section className={card}>
        <p className="text-muted-foreground">Tu contrato no tiene garantía.</p>
      </section>
    );
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
          <div className="text-sm text-muted-foreground">Garantía</div>
          <div className="mt-1 text-[28px] font-bold">{formatSoles(d.amount)}</div>
          <div className="text-sm text-muted-foreground">{DEPOSIT_RULE_LABEL[d.rule]}</div>
        </div>
        <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
          <div className="text-sm text-muted-foreground">Estado</div>
          <div className="my-2">
            <DepositBadge phase={d.phase} />
          </div>
          <div className="text-sm text-muted-foreground">
            {d.phase === "unpaid"
              ? "Está en tu recibo, en Mis pagos."
              : d.phase === "returned"
                ? "Ya se cerró."
                : `Se devuelve al salir, en ${d.refundDays} días hábiles.`}
          </div>
        </div>
      </div>

      {d.settlement ? <Settlement d={d} /> : null}

      <section className={card}>
        <h2 className="text-lg font-bold">Lo que ya estaba al entrar</h2>
        <p className="text-sm text-muted-foreground">
          No tienes que revisar todo. Si notas algo que ya estaba mal (un rayón, una manija floja), repórtalo
          con una foto y no se te descontará al salir.
        </p>
        {d.entryReports.length ? (
          <ul>
            {d.entryReports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 border-t py-3 first:border-t-0">
                <span className="min-w-40 flex-1 text-sm">
                  <b className="block">{AREA_LABEL[r.area]}</b>
                  <span className="text-muted-foreground">{r.note}</span>
                </span>
                <a
                  href={`/archivos/ingreso/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", className: "h-11" })}
                >
                  Ver foto
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {d.canReport ? (
          <div className="flex flex-col items-start gap-1">
            <EntryReportForm businessId={d.businessId} residentId={d.residentId} contractId={d.contractId} />
            <span className="text-sm text-muted-foreground">
              Puedes reportar hasta el {formatLongDate(d.reportUntil)}.
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            El plazo para reportar terminó el {formatLongDate(d.reportUntil)}.
          </p>
        )}
      </section>

      {!d.settlement ? (
        <>
          <section className={card}>
            <h2 className="text-lg font-bold">Cómo funciona</h2>
            <ol className="flex flex-col">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-3 border-t py-3 first:border-t-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
                    {i + 1}
                  </span>
                  <span>
                    <b className="block">{title}</b>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className={card}>
            <h2 className="text-lg font-bold">Qué cubre</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {d.covers.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  Daños en {AREA_LABEL[a].toLowerCase()}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">No cubre el desgaste normal por el uso.</p>
          </section>
        </>
      ) : null}
    </>
  );
}

async function Content() {
  const list = await getMyDeposits();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Mi garantía</h1>
        <p className="text-muted-foreground">
          Es el dinero que dejas como respaldo. Se te devuelve cuando termina tu contrato, menos los daños que
          se encuentren.
        </p>
      </div>
      {list.length ? (
        list.map((x, i) => (
          <div key={i} className="flex flex-col gap-4">
            {list.length > 1 ? <h2 className="text-lg font-bold">{x.businessName}</h2> : null}
            {x.deposit ? (
              <Deposit d={x.deposit} />
            ) : (
              <p className="text-muted-foreground">
                Todavía no hay garantía: se registra cuando tu residencia confirma tu contrato.
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="text-muted-foreground">Tu cuenta todavía no está en ninguna residencia.</p>
      )}
    </>
  );
}

export default function MyDepositPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
